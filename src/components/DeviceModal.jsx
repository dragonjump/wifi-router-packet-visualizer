import React from 'react';
import { Cpu, Zap, Activity, Shield, RefreshCw, X, Globe, HardDrive, Wifi, Smartphone, Tv, Laptop, Box } from 'lucide-react';

const DeviceModal = ({ device, onClose, recentTraffic, isBlocked, onBlock, onUnblock }) => {
    if (!device) return null;

    const [isAdminMode, setIsAdminMode] = React.useState(false);
    const [pwd, setPwd] = React.useState('');

    const getDeviceIcon = (type) => {
        switch (type) {
            case 'mobile': return <Smartphone className="w-8 h-8 text-blue-400" />;
            case 'tv': return <Tv className="w-8 h-8 text-purple-400" />;
            case 'pc': return <Laptop className="w-8 h-8 text-emerald-400" />;
            default: return <Box className="w-8 h-8 text-amber-400" />;
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/80 backdrop-blur-md transition-opacity"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div style={{ maxHeight: '65vh', overflowY: 'auto' }} className="relative w-full max-w-4xl glass border-t-4 border-blue-500 shadow-2xl overflow-hidden flex flex-col h-[65vh] animate-in">

                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white/40 hover:text-white z-20"
                >
                    <X className="w-5 h-5" />
                </button>

                {/* Header Section */}
                <div className="p-8 bg-gradient-to-b from-blue-500/10 to-transparent border-b border-white/5">
                    <div className="flex items-start gap-6">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/10 glow">
                            {getDeviceIcon(device.type)}
                        </div>
                        <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                                <h2 className="text-2xl font-bold tracking-tight text-white">{device.label || device.name}</h2>
                                <span className={`px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${isBlocked ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
                                    }`}>
                                    {isBlocked ? 'BLOCKED' : (device.status || 'ONLINE')}
                                </span>
                            </div>
                            <p className="font-mono text-sm text-blue-400/60 mb-4">{device.ip}</p>

                            <div className="flex gap-6">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Signal Strength</span>
                                    <div className="flex items-center gap-2 mt-1">
                                        <div className="h-1.5 w-12 bg-white/5 rounded-full overflow-hidden">
                                            <div className="h-full bg-green-500 w-3/4 shadow-[0_0_8px_rgba(34,197,94,0.5)]"></div>
                                        </div>
                                        <span className="text-xs font-mono text-green-400">{device.signal || '-64 dBm'}</span>
                                    </div>
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Active Uptime</span>
                                    <span className="text-xs font-mono text-blue-400 mt-1">{device.uptime || '2h 14m'}</span>
                                </div>
                                <div className="h-10 w-px bg-white/10" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-white/30 uppercase font-bold tracking-widest">Link Rate</span>
                                    <span className="text-xs font-mono text-yellow-400 mt-1">866 Mbps</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex flex-1 overflow-hidden min-h-0 bg-black/20">
                    {/* Left Sidebar: Detailed Specs */}
                    <div className="w-80 border-r border-white/5 p-8 space-y-8 overflow-y-auto custom-scrollbar">

                        {/* Admin Actions */}
                        <section className="p-4 bg-white/5 rounded-xl border border-white/5">
                            <h3 className="text-[10px] font-black text-red-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Admin Firewall Control
                            </h3>

                            {!isAdminMode ? (
                                <div className="space-y-3">
                                    <input
                                        type="password"
                                        placeholder="Admin Password..."
                                        value={pwd}
                                        onChange={(e) => setPwd(e.target.value)}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[10px] outline-none focus:border-blue-500 transition-colors"
                                    />
                                    <button
                                        onClick={() => setIsAdminMode(true)}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-[10px] font-bold py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <Zap className="w-3 h-3" /> ACCESS GATEWAY
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4 text-center">
                                    {isBlocked ? (
                                        <button
                                            onClick={onUnblock}
                                            className="w-full bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/40 text-[10px] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <Zap className="w-3.5 h-3.5 animate-pulse" /> RESTORE ACCESS
                                        </button>
                                    ) : (
                                        <button
                                            onClick={onBlock}
                                            className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40 text-[10px] font-bold py-3 rounded-xl transition-all flex items-center justify-center gap-2"
                                        >
                                            <Shield className="w-3.5 h-3.5" /> BLOCK TRAFFIC
                                        </button>
                                    )}
                                    <p className="text-[9px] text-white/30 italic">Target Restricted via Virtual Gateway</p>
                                </div>
                            )}
                        </section>

                        <section>
                            <h3 className="text-xs font-black text-blue-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <HardDrive className="w-3.5 h-3.5" /> Hardware Specs
                            </h3>
                            <div className="space-y-4">
                                <SpecItem label="Manufacturer" value={device.vendor || "Generic / Unknown"} />
                                <SpecItem label="MAC Address" value={device.mac || "FF:FF:FF:FF:FF:FF"} />
                                <SpecItem label="Interface" value={device.connectionType?.toUpperCase() || "WIRELESS"} icon={<Wifi className="w-2.5 h-2.5 opacity-40" />} />
                                <SpecItem label="IP Assignment" value="DHCP Dynamic" />
                            </div>
                        </section>

                        <section>
                            <h3 className="text-xs font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                <Shield className="w-3.5 h-3.5" /> Security & Networking
                            </h3>
                            <div className="space-y-4">
                                <SpecItem label="Access Level" value="Standard User" />
                                <SpecItem label="Firewall State" value="Filtering Active" />
                                <SpecItem label="VLAN" value="None (Untagged)" />
                            </div>
                        </section>
                    </div>

                    {/* Right Panel: Traffic Logs */}
                    <div className="flex-1 flex flex-col bg-black/40 min-h-0 overflow-hidden">
                        <div className="p-4 border-b border-white/5 flex justify-between items-center shrink-0">
                            <h3 className="text-xs font-black text-white/80 uppercase tracking-widest flex items-center gap-2">
                                <Activity className="w-3.5 h-3.5 text-red-500" /> Live Traffic Stream
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-[10px] font-bold text-red-500/80">REAL-TIME</span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                            <table className="w-full text-left font-mono text-[11px] border-separate border-spacing-y-1.5">
                                <thead className="sticky top-0 bg-[#0a0a0c]/95 backdrop-blur-sm z-10">
                                    <tr className="text-white/20 text-[9px] uppercase tracking-tighter">
                                        <th className="pb-3 pl-2">Timestamp</th>
                                        <th className="pb-3 text-center">Dir</th>
                                        <th className="pb-3">Geo</th>
                                        <th className="pb-3">Endpoint</th>
                                        <th className="pb-3">Protocol</th>
                                        <th className="pb-3 pr-2 text-right">Size</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {recentTraffic.length > 0 ? recentTraffic.map((p, i) => (
                                        <tr key={i} className="group hover:bg-white/5 transition-colors border border-transparent hover:border-white/10">
                                            <td className="py-2 pl-2 text-white/40 group-hover:text-white/60">
                                                {new Date(p.timestamp).toLocaleTimeString([], { hour12: false, fractionalSecondDigits: 1 })}
                                            </td>
                                            <td className="py-2 text-center text-[10px]">
                                                {p.src === device.ip ? (
                                                    <span className="text-red-400 font-black">OUT</span>
                                                ) : (
                                                    <span className="text-green-400 font-black">IN</span>
                                                )}
                                            </td>
                                            <td className="py-2 text-[14px]">
                                                {p.src === device.ip ? (p.flag || '🌐') : '🏠'}
                                            </td>
                                            <td className="py-2 font-bold text-white/70 group-hover:text-white truncate max-w-[140px]">
                                                <span className="opacity-40 font-black mr-2 text-[9px]">{p.country}</span>
                                                {p.src === device.ip ? p.dest : p.src}
                                            </td>
                                            <td className="py-2">
                                                <span className={`px-1.5 py-0.5 rounded-sm text-[9px] font-black ${p.protocol === 'TCP' ? 'bg-blue-500/20 text-blue-400' : 'bg-purple-500/20 text-purple-400'
                                                    }`}>
                                                    {p.protocol}
                                                </span>
                                            </td>
                                            <td className="py-2 text-blue-400/60 font-black">{p.destPort}</td>
                                            <td className="py-2 pr-2 text-right text-white/30">{p.len} B</td>
                                        </tr>
                                    )) : (
                                        <tr>
                                            <td colSpan="6" className="py-20 text-center">
                                                <div className="flex flex-col items-center gap-3 opacity-20">
                                                    <RefreshCw className="w-10 h-10 animate-spin-slow" />
                                                    <span className="text-[10px] uppercase font-bold tracking-[0.2em]">Monitoring Data Flows...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const SpecItem = ({ label, value, icon }) => (
    <div className="group border-b border-white/[0.03] pb-3 last:border-0 hover:border-white/10 transition-colors">
        <span className="text-[9px] text-white/20 uppercase font-black tracking-widest block mb-1">{label}</span>
        <div className="flex items-center gap-2">
            {icon}
            <span className="text-xs text-white/80 group-hover:text-white font-mono truncate">{value}</span>
        </div>
    </div>
);

export default DeviceModal;
