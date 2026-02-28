import React from 'react';
import { X, Zap, Activity, Signal, Navigation, BarChart3 } from 'lucide-react';

const InsightModal = ({ type, data, onClose }) => {
    if (!type || !data) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <div className="absolute inset-0 bg-black/90 backdrop-blur-xl transition-opacity" onClick={onClose} />

            <div className="relative w-full max-w-2xl glass border-t-4 shadow-2xl overflow-hidden animate-in"
                style={{ borderColor: type === 'signal' ? '#ef4444' : '#a855f7' }}>

                <button onClick={onClose} className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-full transition-colors text-white/40">
                    <X className="w-5 h-5" />
                </button>

                {type === 'signal' ? (
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="bg-red-500/20 p-4 rounded-2xl">
                                <Zap className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Worst Signal Analysis</h2>
                                <p className="text-sm text-red-400/60 font-mono italic">Distance & Interference Check</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-8 mb-8">
                            <div className="glass p-6 border-l-2 border-red-500">
                                <span className="text-[10px] text-white/30 uppercase font-black block mb-2">Subject Device</span>
                                <p className="text-xl font-bold text-white mb-1">{data.name}</p>
                                <p className="text-xs font-mono text-white/40">{data.ip}</p>
                            </div>
                            <div className="glass p-6 border-l-2 border-red-500">
                                <span className="text-[10px] text-white/30 uppercase font-black block mb-2">Measured Signal</span>
                                <p className="text-3xl font-black text-red-400">{data.signal}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-6">
                                <div className="flex-1">
                                    <div className="flex justify-between mb-2">
                                        <span className="text-xs font-bold text-white/60">ESTIMATED DISTANCE</span>
                                        <span className="text-xs font-mono text-red-400">
                                            {Math.abs(parseInt(data.signal)) > 75 ? 'Far (15-20m)' : 'Medium (8-12m)'}
                                        </span>
                                    </div>
                                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                                        <div className="h-full bg-red-400"
                                            style={{ width: `${Math.min(100, Math.abs(parseInt(data.signal)))}%` }} />
                                    </div>
                                </div>
                                <Navigation className="w-6 h-6 text-red-500 animate-pulse" />
                            </div>

                            <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                <h3 className="text-xs font-black text-white/80 uppercase mb-2">Why is it bad?</h3>
                                <p className="text-xs text-white/60 leading-relaxed font-mono">
                                    The signal strength of {data.signal} indicates significant path loss. Possible causes include:
                                    <br />• Physical obstructions (thick walls, metal cabinets)
                                    <br />• {Math.abs(parseInt(data.signal)) > 70 ? 'Extreme range from the gateway' : 'Interference from 2.4GHz consumer electronics'}
                                </p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="bg-purple-500/20 p-4 rounded-2xl">
                                <Activity className="w-8 h-8 text-purple-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold tracking-tight text-white uppercase">Traffic Usage Leaderboard</h2>
                                <p className="text-sm text-purple-400/60 font-mono italic">Top Consumer Ranking</p>
                            </div>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                            {data.sort((a, b) => b.usage - a.usage).map((item, i) => (
                                <div key={i} className="glass p-4 flex items-center gap-4 border border-white/5 hover:bg-white/5 transition-colors">
                                    <div className="w-8 h-8 flex items-center justify-center font-black text-purple-400 border border-purple-500/20 rounded-lg text-sm bg-purple-500/5">
                                        #{i + 1}
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-white">{item.name}</p>
                                        <p className="text-[10px] font-mono text-white/40">{item.ip}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-black text-purple-300">{(item.usage / 1024).toFixed(1)} KB</p>
                                        <div className="h-1 w-24 bg-white/5 rounded-full mt-1.5 overflow-hidden">
                                            <div className="h-full bg-purple-500"
                                                style={{ width: `${(item.usage / data[0].usage) * 100}%` }} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default InsightModal;
