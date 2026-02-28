import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { Activity, Shield, Wifi, Globe, Zap, Cpu, Search, SortAsc, Pause, Play, Terminal, Info, RefreshCw } from 'lucide-react';
import Visualizer from './components/Visualizer';
import DeviceModal from './components/DeviceModal';

const App = () => {
    const [packets, setPackets] = useState([]);
    const [isPaused, setIsPaused] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('timestamp');
    const [selectedPacket, setSelectedPacket] = useState(null);
    const [selectedNode, setSelectedNode] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [showDeviceModal, setShowDeviceModal] = useState(false);
    const [showCountryModal, setShowCountryModal] = useState(false);
    const [visualMode, setVisualMode] = useState('normal'); // 'normal', 'signal', 'usage'
    const [usageStats, setUsageStats] = useState({});
    const [stats, setStats] = useState({
        pps: 0,
        bandwidth: 0,
        totalPackets: 0
    });
    const [devices, setDevices] = useState([]);
    const [blockedIps, setBlockedIps] = useState([]);
    const [isScanning, setIsScanning] = useState(false);
    const [recentTraffic, setRecentTraffic] = useState([]);
    const socketRef = useRef(null);
    const trafficTimerRef = useRef(null);

    useEffect(() => {
        console.log('App: Node selected ->', selectedNode);
    }, [selectedNode]);

    useEffect(() => {
        socketRef.current = io();

        socketRef.current.on('packet', (packet) => {
            if (!isPaused) {
                setPackets((prev) => [packet, ...prev].slice(0, 200));
                setStats((prev) => ({
                    ...prev,
                    pps: prev.pps + 1,
                    totalPackets: prev.totalPackets + 1,
                    bandwidth: prev.bandwidth + packet.len
                }));
            }
        });

        socketRef.current.on('deviceUpdate', (newDevices) => {
            console.log('Real-time device update received:', newDevices);
            setDevices(newDevices);
            setIsScanning(false);
        });

        socketRef.current.on('deviceBlocked', (ip) => {
            setBlockedIps(prev => [...new Set([...prev, ip])]);
        });

        socketRef.current.on('deviceUnblocked', (ip) => {
            setBlockedIps(prev => prev.filter(blockedIp => blockedIp !== ip));
        });

        // Initial fetch
        fetch('/api/devices')
            .then(res => {
                if (!res.ok) throw new Error('Network response was not ok');
                return res.json();
            })
            .then(data => setDevices(data))
            .catch(err => console.error('Failed to fetch devices:', err));

        const statsInterval = setInterval(() => {
            setStats(prev => ({ ...prev, pps: 0 }));
        }, 1000);

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
            clearInterval(statsInterval);
        };
    }, [isPaused]);

    useEffect(() => {
        if (!selectedNode || isPaused) {
            setRecentTraffic([]);
            if (trafficTimerRef.current) clearInterval(trafficTimerRef.current);
            return;
        }

        const fetchLatestTraffic = () => {
            setRecentTraffic(prev => {
                const nodePackets = packets.filter(p =>
                    p.src === selectedNode.ip || p.dest === selectedNode.ip
                );
                return nodePackets.slice(0, 50);
            });
        };

        fetchLatestTraffic();
        trafficTimerRef.current = setInterval(fetchLatestTraffic, 5000);

        return () => clearInterval(trafficTimerRef.current);
    }, [selectedNode, packets, isPaused]);

    const getDeviceName = (ip) => {
        const device = devices.find(d => d.ip === ip);
        return device ? device.name : ip;
    };

    const filteredPackets = packets
        .filter(p => {
            if (selectedNode) {
                if (selectedNode.type === 'router') {
                    // All traffic
                } else if (selectedNode.type === 'app') {
                    if (!selectedNode.ports.includes(p.destPort)) return false;
                } else {
                    if (p.src !== selectedNode.ip && p.dest !== selectedNode.ip) return false;
                }
            }

            const matchesSearch =
                p.dest.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.src.toLowerCase().includes(searchQuery.toLowerCase()) ||
                p.protocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.country && p.country.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (p.destPort && p.destPort.toString().includes(searchQuery));

            return matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'len') return b.len - a.len;
            if (sortBy === 'protocol') return a.protocol.localeCompare(b.protocol);
            return b.timestamp - a.timestamp;
        });

    const findWorstSignal = () => {
        if (visualMode === 'signal') {
            setVisualMode('normal');
            return;
        }

        // Only analyze wireless client devices
        const clientDevices = devices.filter(d =>
            d.type !== 'router' &&
            d.type !== 'app' &&
            d.connectionType === 'wireless'
        );

        if (clientDevices.length === 0) return;

        const worst = [...clientDevices].sort((a, b) => {
            const valA = parseInt(a.signal?.replace(/[^-0-9]/g, '') || '-100');
            const valB = parseInt(b.signal?.replace(/[^-0-9]/g, '') || '-100');
            return valA - valB;
        })[0];

        setSelectedNode(worst);
        setShowDeviceModal(false);
        setVisualMode('signal');
    };

    const findMostUsage = () => {
        if (visualMode === 'usage') {
            setVisualMode('normal');
            return;
        }

        if (packets.length === 0) return;
        const usageMap = {};
        packets.forEach(p => {
            usageMap[p.src] = (usageMap[p.src] || 0) + p.len;
            usageMap[p.dest] = (usageMap[p.dest] || 0) + p.len;
        });

        setUsageStats(usageMap);

        const usageList = devices
            .filter(d => usageMap[d.ip])
            .map(d => ({ ...d, usage: usageMap[d.ip] }))
            .sort((a, b) => b.usage - a.usage);

        if (usageList.length > 0) {
            setSelectedNode(usageList[0]);
            setShowDeviceModal(false);
            setVisualMode('usage');
        }
    };

    const handleNodeSelection = (node) => {
        setSelectedNode(node);
        setVisualMode('normal'); // Reset visual mode when selecting manually
        if (node && node.type !== 'router' && node.type !== 'app') {
            setShowDeviceModal(true);
        } else {
            setShowDeviceModal(false);
        }
    };

    const handleBlockDevice = (ip) => {
        if (socketRef.current) {
            socketRef.current.emit('blockDevice', ip);
        }
    };

    const handleUnblockDevice = (ip) => {
        if (socketRef.current) {
            socketRef.current.emit('unblockDevice', ip);
        }
    };

    const getCountryStats = () => {
        const counts = {};
        packets.forEach(p => {
            if (p.country) {
                if (!counts[p.country]) counts[p.country] = { count: 0, flag: p.flag };
                counts[p.country].count++;
            }
        });
        return Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
    };

    const findLongestUptime = () => {
        if (visualMode === 'uptime') {
            setVisualMode('normal');
            return;
        }

        const clientDevices = devices.filter(d => d.type !== 'router' && d.type !== 'app');
        if (clientDevices.length === 0) return;

        const parseUptime = (str) => {
            if (!str) return 0;
            const h = (str.match(/(\d+)h/) || [0, 0])[1];
            const m = (str.match(/(\d+)m/) || [0, 0])[1];
            return (parseInt(h) * 60) + parseInt(m);
        };

        const sorted = [...clientDevices].sort((a, b) => parseUptime(b.uptime) - parseUptime(a.uptime));

        if (sorted.length > 0) {
            setSelectedNode(sorted[0]);
            setShowDeviceModal(false);
            setVisualMode('uptime');
        }
    };

    return (
        <div className="h-screen w-full relative overflow-hidden bg-[#050505] text-white">
            <Visualizer
                packets={isPaused ? [] : packets}
                devices={devices}
                blockedIps={blockedIps}
                onSelectNode={handleNodeSelection}
                selectedNode={selectedNode}
                visualMode={visualMode}
                usageStats={usageStats}
            />

            <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none h-full z-10">
                <div className={`flex flex-col gap-4 pointer-events-auto h-full max-w-sm transition-all duration-500 ease-in-out ${showSidebar ? 'translate-x-0 opacity-100' : '-translate-x-[calc(100%+24px)] opacity-0'}`}>
                    <div className="glass p-4 border-l-4 border-blue-500 glow flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-500/20 p-2 rounded-lg">
                                <Wifi className="text-blue-400 w-6 h-6" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold tracking-tight">AX1800 Monitor</h1>
                                <p className="text-[10px] text-blue-400/80 font-mono">TIME2E30 • {devices.length} DEVICES</p>
                            </div>
                        </div>
                        {isScanning && <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />}
                    </div>

                    {selectedNode ? (
                        <div className="glass p-5 border-l-4 border-green-500 animate-in">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="bg-green-500/20 p-2 rounded-lg">
                                    <Cpu className="text-green-400 w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold truncate">{selectedNode.label}</h2>
                                    <p className="text-[10px] text-white/40 font-mono uppercase tracking-widest">{selectedNode.type}</p>
                                </div>
                                <button onClick={() => setSelectedNode(null)} className="ml-auto text-white/20 hover:text-white">✕</button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-[10px] font-mono">
                                {selectedNode.ip && <DetailItem label="Address" value={selectedNode.ip} />}
                                {selectedNode.mac && <DetailItem label="MAC" value={selectedNode.mac} />}
                                {selectedNode.status && <DetailItem label="Status" value={selectedNode.status} />}
                                {selectedNode.signal && <DetailItem label="Signal" value={selectedNode.signal} />}
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-3 shrink-0">
                            <StatCard icon={<Zap className="w-4 h-4" />} label="PPS" value={stats.pps} color="text-yellow-400" />
                            <StatCard icon={<Activity className="w-4 h-4" />} label="LOAD" value={`${(stats.bandwidth / 1024).toFixed(1)} KB/s`} color="text-green-400" />
                            <StatCard icon={<Cpu className="w-4 h-4" />} label="NODES" value={devices.length} color="text-purple-400" />
                            <StatCard icon={<Shield className="w-4 h-4" />} label="STATUS" value={isPaused ? "PAUSED" : "SCANNING"} color={isPaused ? "text-red-400" : "text-blue-400"} />
                        </div>
                    )}

                    {/* Quick Insight Actions */}
                    {!selectedNode && (
                        <div className="flex flex-col gap-2 shrink-0">
                            <div className="flex gap-2">
                                <button
                                    onClick={findWorstSignal}
                                    className={`flex-1 glass py-2 px-3 border-l-2 text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${visualMode === 'signal' ? 'bg-red-500/20 border-red-500 scale-[1.02]' : 'border-red-500/40 hover:bg-white/10'
                                        }`}
                                >
                                    <Zap className={`w-3 h-3 ${visualMode === 'signal' ? 'text-red-400' : 'text-red-400/40'}`} /> Worst Signal
                                </button>
                                <button
                                    onClick={findMostUsage}
                                    className={`flex-1 glass py-2 px-3 border-l-2 text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${visualMode === 'usage' ? 'bg-purple-500/20 border-purple-500 scale-[1.02]' : 'border-purple-500/40 hover:bg-white/10'
                                        }`}
                                >
                                    <Activity className={`w-3 h-3 ${visualMode === 'usage' ? 'text-purple-400' : 'text-purple-400/40'}`} /> Most Usage
                                </button>
                            </div>
                            <button
                                onClick={findLongestUptime}
                                className={`w-full glass py-2 px-3 border-l-2 text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${visualMode === 'uptime' ? 'bg-blue-500/20 border-blue-500 scale-[1.02]' : 'border-blue-500/40 hover:bg-white/10'
                                    }`}
                            >
                                <RefreshCw className={`w-3 h-3 ${visualMode === 'uptime' ? 'text-blue-400' : 'text-blue-400/40'}`} /> Longest Connected
                            </button>
                            <button
                                onClick={() => {
                                    console.log('Toggling Country Modal:', !showCountryModal);
                                    setShowCountryModal(!showCountryModal);
                                }}
                                className={`w-full glass py-2 px-3 border-l-2 text-[10px] font-black tracking-widest uppercase transition-all flex items-center justify-center gap-2 ${showCountryModal ? 'bg-emerald-500-20 border-emerald-500 scale-102' : 'border-emerald-500-40 hover:bg-white/10'
                                    }`}
                            >
                                <Globe className={`w-3 h-3 ${showCountryModal ? 'text-emerald-400' : 'text-emerald-400/40'}`} /> Global Footprint
                            </button>
                        </div>
                    )}

                    <div className="glass p-5 flex flex-col flex-1 min-h-0">
                        <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
                            <h3 className="text-sm font-bold flex items-center gap-2">
                                <Terminal className="w-4 h-4 text-blue-400" />
                                Packet Inspector
                            </h3>
                            <button
                                onClick={() => setIsPaused(!isPaused)}
                                className={`flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full transition-all ${isPaused ? 'bg-green-500/20 text-green-400' : 'bg-red-500/10 text-red-400'
                                    }`}
                            >
                                {isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                                {isPaused ? 'RESUME' : 'PAUSE'}
                            </button>
                        </div>

                        <div className="space-y-3 mb-4">
                            <div className="relative group">
                                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-white/20 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search by IP, Port, Type..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full bg-black/40 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/50 transition-all placeholder:text-white/20"
                                />
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full bg-blue-500/10 border border-white/10 rounded-md px-2 py-1.5 text-[10px] outline-none font-bold text-blue-300"
                            >
                                <option value="timestamp">Sort by Time (Latest)</option>
                                <option value="len">Sort by Payload Size</option>
                                <option value="protocol">Sort by Protocol</option>
                            </select>
                        </div>

                        <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 custom-scrollbar">
                            {filteredPackets.map((p, i) => (
                                <div
                                    key={i}
                                    onClick={() => setSelectedPacket(p)}
                                    className={`relative group overflow-hidden border border-white/5 rounded-lg p-2.5 cursor-pointer transition-all ${selectedPacket?.timestamp === p.timestamp ? 'bg-blue-500/20 border-blue-500/40' : 'bg-white/5 hover:bg-white/10'
                                        }`}
                                >
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] ${p.protocol === 'TCP' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/30 text-purple-300'
                                            }`}>
                                            {p.protocol}
                                        </span>
                                        <span className="text-[9px] font-mono opacity-30">{new Date(p.timestamp).toLocaleTimeString([], { hour12: false })}</span>
                                    </div>
                                    <div className="flex items-center gap-2 font-mono text-[10px]">
                                        <span className={`truncate w-24 text-right ${devices.some(d => d.ip === p.src) ? 'text-green-400 font-bold' : 'text-white/50'}`}>
                                            {getDeviceName(p.src)}
                                        </span>
                                        <span className="text-blue-500/40">»</span>
                                        <span className="text-white truncate flex items-center gap-1.5" title={`${p.country} - ${p.dest}`}>
                                            {p.flag} <span className="opacity-40 font-black">{p.country?.toUpperCase()}</span>
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {selectedPacket && (
                    <div className="glass p-6 w-[350px] pointer-events-auto h-fit mt-auto border-t-4 border-yellow-500 animate-in">
                        <div className="flex items-center justify-between mb-5">
                            <h4 className="text-sm font-bold flex items-center gap-2 text-yellow-400 uppercase tracking-tighter">
                                <Shield className="w-4 h-4" /> Connection Detail
                            </h4>
                            <button onClick={() => setSelectedPacket(null)} className="text-white/40 hover:text-white">✕</button>
                        </div>
                        <div className="space-y-3 font-mono text-[11px]">
                            <DetailRow label="SOURCE DEVICE" value={getDeviceName(selectedPacket.src)} highlight={devices.some(d => d.ip === selectedPacket.src)} />
                            <DetailRow label="SOURCE IP" value={selectedPacket.src} />
                            <DetailRow label="DESTINATION" value={selectedPacket.dest} highlight />
                            <div className="grid grid-cols-2 gap-4 border-y border-white/5 py-3 my-3">
                                <DetailRow label="PROTOCOL" value={selectedPacket.protocol} />
                                <DetailRow label="SERVICE PORT" value={selectedPacket.destPort} />
                            </div>
                            <DetailRow label="PAYLOAD SIZE" value={`${selectedPacket.len} Bytes`} />
                            {selectedPacket.country && (
                                <DetailRow label="DESTINATION COUNTRY" value={`${selectedPacket.flag} ${selectedPacket.country.toUpperCase()}`} highlight />
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar Toggle Button */}
            <button
                onClick={() => setShowSidebar(!showSidebar)}
                className={`absolute top-6 left-6 z-20 glass p-3 border-white/20 transition-all duration-500 pointer-events-auto hover:bg-white/10 ${showSidebar ? 'translate-x-sidebar rotate-180' : 'translate-x-0'}`}
                title={showSidebar ? "Hide Panel" : "Show Panel"}
            >
                <div className="flex items-center gap-2">
                    <SortAsc className={`w-4 h-4 text-blue-400 transition-transform ${showSidebar ? 'rotate-90' : '-rotate-90'}`} />
                    {!showSidebar && <span className="text-[10px] font-black tracking-widest text-blue-400">INSPECTOR</span>}
                </div>
            </button>

            <div className="absolute top-6 left-half translate-x-neg-half glass px-6 py-2 flex items-center gap-3 border-t-2 border-blue-500">
                <Info className="w-4 h-4 text-blue-400" />
                <span className="text-xs font-bold text-white/60 tracking-widest uppercase">
                    Select a Device to View Traffic Log
                </span>
            </div>

            {/* Client Device Modal */}
            {selectedNode && showDeviceModal && (
                <DeviceModal
                    device={selectedNode}
                    isBlocked={blockedIps.includes(selectedNode.ip)}
                    onBlock={() => handleBlockDevice(selectedNode.ip)}
                    onUnblock={() => handleUnblockDevice(selectedNode.ip)}
                    onClose={() => {
                        setSelectedNode(null);
                        setShowDeviceModal(false);
                    }}
                    recentTraffic={recentTraffic}
                />
            )}

            {showCountryModal && (
                <div className="absolute top-24 right-6 w-64 glass border-r-4 border-emerald-500 p-5 animate-in z-60 shadow-2xl pointer-events-auto">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                            <Globe className="w-4 h-4" /> Geo-Distribution
                        </h3>
                        <button onClick={() => setShowCountryModal(false)} className="text-white/20 hover:text-white">✕</button>
                    </div>
                    <div className="space-y-3">
                        {getCountryStats().length > 0 ? getCountryStats().map(([name, data]) => (
                            <div key={name} className="flex items-center justify-between bg-white/5 p-2 rounded-lg border border-white/5 group hover:border-emerald-500/30 transition-colors">
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{data.flag}</span>
                                    <span className="text-xs-small font-bold text-white/80 uppercase tracking-tighter">{name}</span>
                                </div>
                                <div className="flex flex-col items-end">
                                    <span className="text-[10px] font-mono text-emerald-400">{data.count}</span>
                                    <span className="text-[8px] text-white/20 font-bold uppercase">Packets</span>
                                </div>
                            </div>
                        )) : (
                            <div className="py-8 text-center opacity-20 text-[10px] font-bold uppercase tracking-widest">
                                Waiting for external traffic...
                            </div>
                        )}
                    </div>
                </div>
            )}


            {/* Old Detail Panel - Only for Router or Apps now if needed, or just remove if we want Modal for everything */}
            {selectedNode && (selectedNode.type === 'router' || selectedNode.type === 'app') && (
                <div className="absolute bottom-10 left-half translate-x-neg-half w-[95%] max-w-6xl glass border-b-4 border-blue-500 animate-in overflow-hidden max-h-[45vh] flex flex-col shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10">
                        <div className="flex items-center gap-6">
                            <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${selectedNode.color}22`}>
                                    <Cpu className={`w-5 h-5 ${selectedNode.color.replace('#', 'text-[') + ']'}`} style={{ color: selectedNode.color }} />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold tracking-tight">{selectedNode.label}</h2>
                                    <p className="text-[10px] opacity-40 font-mono italic">{selectedNode.ip}</p>
                                </div>
                            </div>

                            <div className="h-8 w-px bg-white/10" />

                            <div className="flex gap-4">
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-white/30 uppercase font-bold">Signal</span>
                                    <span className="text-xs font-mono text-green-400">{selectedNode.signal || '-64 dBm'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-white/30 uppercase font-bold">Uptime</span>
                                    <span className="text-xs font-mono text-blue-400">{selectedNode.uptime || '2h 14m'}</span>
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[8px] text-white/30 uppercase font-bold">Rate</span>
                                    <span className="text-xs font-mono text-yellow-400">866 Mbps</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <span className="px-3 py-1 bg-blue-500/10 text-blue-400 text-[9px] font-bold rounded-full border border-blue-500/20 animate-pulse">
                                LIVE STREAMING
                            </span>
                            <button onClick={() => setSelectedNode(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white">✕</button>
                        </div>
                    </div>

                    <div className="flex flex-1 min-h-0">
                        {/* Device Info Sidebar */}
                        <div className="w-64 bg-black/20 border-r border-white/5 p-4 space-y-4 overflow-y-auto custom-scrollbar">
                            <div>
                                <h3 className="text-[9px] text-blue-400 font-bold uppercase tracking-widest mb-3">Hardware Info</h3>
                                <div className="space-y-3">
                                    <DetailItem label="Manufacturer" value={selectedNode.vendor || "Guessed via MAC"} />
                                    <DetailItem label="MAC Address" value={selectedNode.mac || "FF:FF:FF:FF:FF:FF"} />
                                    <DetailItem label="Connection" value={selectedNode.connectionType?.toUpperCase() || "WIRELESS"} />
                                    <DetailItem label="IP Assignment" value="DHCP Static" />
                                </div>
                            </div>
                            <div>
                                <h3 className="text-[9px] text-purple-400 font-bold uppercase tracking-widest mb-3">Security</h3>
                                <div className="space-y-3">
                                    <DetailItem label="Firewall" value="Passing (SPI)" />
                                    <DetailItem label="VLAN Tag" value="None (UNTYPED)" />
                                </div>
                            </div>
                        </div>

                        {/* Traffic Table */}
                        <div className="flex-1 overflow-auto custom-scrollbar bg-black/40 p-4">
                            <table className="w-full text-left font-mono text-[10px] border-separate border-spacing-y-1">
                                <thead className="sticky top-0 bg-[#0a0a0c] z-10">
                                    <tr className="text-white/30 text-[9px] border-b border-white/5 uppercase">
                                        <th className="pb-2 pl-2">Time</th>
                                        <th className="pb-2">Flow</th>
                                        <th className="pb-2">Remote Destination</th>
                                        <th className="pb-2">Protocol</th>
                                        <th className="pb-2">Port</th>
                                        <th className="pb-2 pr-2">Bytes</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTraffic.length > 0 ? recentTraffic.map((p, i) => (
                                        <tr key={i} className="bg-white/[0.02] hover:bg-white/[0.05] transition-colors">
                                            <td className="py-2 pl-2 text-white/50">{new Date(p.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 })}</td>
                                            <td className="py-2">
                                                {p.src === selectedNode.ip ? (
                                                    <span className="text-red-400 flex items-center gap-1">OUT <Zap className="w-2.5 h-2.5" /></span>
                                                ) : (
                                                    <span className="text-green-400 flex items-center gap-1">IN <RefreshCw className="w-2.5 h-2.5" /></span>
                                                )}
                                            </td>
                                            <td className="py-2 text-white/80 font-bold italic">{p.src === selectedNode.ip ? p.dest : p.src}</td>
                                            <td className="py-2">
                                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${p.protocol === 'TCP' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-purple-500/20 text-purple-400 border border-purple-500/30'}`}>
                                                    {p.protocol}
                                                </span>
                                            </td>
                                            <td className="py-2 text-blue-400/60 font-bold">{p.destPort}</td>
                                            <td className="py-2 pr-2 text-white/30">{p.len} B</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="6" className="py-12 text-center">
                                                <div className="flex flex-col items-center gap-2 opacity-20">
                                                    <Activity className="w-8 h-8 animate-pulse" />
                                                    <span className="text-xs uppercase tracking-tighter italic">Listening for active packets...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const StatCard = ({ icon, label, value, color }) => (
    <div className="glass p-3 flex flex-col gap-1 min-w-[100px] border border-white/5">
        <div className={`flex items-center gap-1.5 text-[9px] uppercase font-bold tracking-widest opacity-80 ${color}`}>
            {icon} {label}
        </div>
        <div className="text-lg font-bold font-mono text-white/90">{value}</div>
    </div>
);

const DetailRow = ({ label, value, highlight }) => (
    <div className="flex flex-col gap-1">
        <span className="text-[8px] text-white/50 uppercase tracking-widest font-bold">{label}</span>
        <span className={`text-[11px] truncate ${highlight ? 'text-blue-400 font-bold' : 'text-white/90'}`}>{value}</span>
    </div>
);

const DetailItem = ({ label, value }) => (
    <div className="flex flex-col gap-0.5">
        <span className="text-[7px] text-white/40 uppercase tracking-widest font-bold">{label}</span>
        <span className="text-[9px] text-white/90 truncate font-mono">{value}</span>
    </div>
);

export default App;
