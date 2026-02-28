import React, { useEffect, useRef, useState } from 'react';

const addAlpha = (color, opacity) => {
    if (!color) return 'transparent';
    if (color.startsWith('rgba')) return color;

    // If it's hex, strip existing alpha if present (8 chars or 4 chars with #)
    let baseColor = color;
    if (color.startsWith('#')) {
        if (color.length === 9) baseColor = color.slice(0, 7);
        else if (color.length === 5) baseColor = color.slice(0, 4);
    }

    const alphaMap = {
        '11': '1c', // ~11%
        '22': '38', // ~22%
        '44': '70', // ~44%
        '66': 'a8'  // ~66%
    };
    return `${baseColor}${alphaMap[opacity] || 'ff'}`;
};

const Visualizer = ({ packets, devices, onSelectNode, selectedNode, visualMode = 'normal', usageStats = {}, blockedIps = [] }) => {
    const canvasRef = useRef(null);
    const particles = useRef([]);
    const nodesRef = useRef({});
    const [hoverNode, setHoverNode] = useState(null);
    const [nodePositions, setNodePositions] = useState({});
    const [draggingNode, setDraggingNode] = useState(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        let animationId;

        const updateNodes = () => {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = window.innerWidth * dpr;
            canvas.height = window.innerHeight * dpr;
            ctx.scale(dpr, dpr);

            canvas.style.width = `${window.innerWidth}px`;
            canvas.style.height = `${window.innerHeight}px`;

            const centerX = window.innerWidth / 2;
            const centerY = window.innerHeight / 2;

            const newNodes = {};

            // Gateway (Center)
            const gatewayPos = nodePositions['router'] || { x: centerX, y: centerY };
            newNodes['router'] = {
                id: 'router',
                ...gatewayPos,
                label: 'wifi-gateway',
                ssid: 'TIME2E30',
                color: '#10b981',
                type: 'router',
                radius: 35
            };

            // Devices (Left)
            const deviceNodes = (devices || []).filter(d => d.type !== 'router');
            const totalDevices = deviceNodes.length;
            const availableHeight = window.innerHeight * 0.85;
            const startY = (window.innerHeight - availableHeight) / 2;

            deviceNodes.forEach((d, i) => {
                const spacing = totalDevices > 1 ? availableHeight / (totalDevices - 1) : 0;

                let dynamicColor = '#3b82f6';
                let dynamicRadius = 25;

                if (visualMode === 'signal' && d.connectionType === 'wireless') {
                    const signalVal = Math.abs(parseInt(d.signal?.replace(/[^-0-9]/g, '') || '-100'));
                    if (signalVal > 75) {
                        dynamicColor = '#ef4444';
                        dynamicRadius = 35;
                    } else if (signalVal > 60) {
                        dynamicColor = '#f59e0b';
                        dynamicRadius = 28;
                    } else {
                        dynamicColor = '#10b981';
                        dynamicRadius = 22;
                    }
                } else if (visualMode === 'usage') {
                    const usage = usageStats[d.ip] || 0;
                    const maxUsage = Math.max(...Object.values(usageStats), 1);
                    const usageRatio = usage / maxUsage;
                    dynamicColor = usage > 0 ? '#a855f7' : '#334155';
                    dynamicRadius = 15 + (usageRatio * 30);
                } else if (visualMode === 'uptime') {
                    const parseUptime = (str) => {
                        if (!str) return 0;
                        const h = (str.match(/(\d+)h/) || [0, 0])[1];
                        const m = (str.match(/(\d+)m/) || [0, 0])[1];
                        return (parseInt(h) * 60) + parseInt(m);
                    };

                    const uptimes = deviceNodes.map(node => parseUptime(node.uptime));
                    const maxUptime = Math.max(...uptimes, 1);
                    const currentUptime = parseUptime(d.uptime);
                    const ratio = currentUptime / maxUptime;

                    dynamicColor = ratio > 0.8 ? '#60a5fa' : '#334155';
                    dynamicRadius = 18 + (ratio * 35); // Scale significantly based on time
                }

                // Initial position if not dragged
                const defaultX = centerX - 250;
                const defaultY = totalDevices > 1 ? startY + (spacing * i) : centerY;
                const pos = nodePositions[d.ip] || { x: defaultX, y: defaultY };

                newNodes[d.ip] = {
                    ...d,
                    ...pos,
                    id: d.ip,
                    label: d.label || d.name,
                    techName: d.name,
                    color: dynamicColor,
                    radius: dynamicRadius
                };
            });

            // Apps (Right)
            const apps = [
                { id: 'web', label: 'Web/HTTPS', color: '#f59e0b', ports: [80, 443] },
                { id: 'dns', label: 'DNS/System', color: '#6366f1', ports: [53] },
                { id: 'voip', label: 'VoIP/Media', color: '#ec4899', ports: [3478, 5228] }
            ];
            apps.forEach((app, i) => {
                const spacing = window.innerHeight / (apps.length + 1);
                const defaultX = centerX + 300;
                const defaultY = spacing * (i + 1);
                const pos = nodePositions[app.id] || { x: defaultX, y: defaultY };

                newNodes[app.id] = {
                    id: app.id,
                    ...pos,
                    label: app.label,
                    color: visualMode === 'normal' ? app.color : '#ffffff',
                    type: 'app',
                    ports: app.ports,
                    radius: 25
                };
            });

            nodesRef.current = newNodes;
        };

        const handleClick = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            console.log('Visualizer Click:', { x, y });

            let found = null;
            Object.values(nodesRef.current).forEach(node => {
                const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                console.log(`Node ${node.label} (${node.type}) dist:`, dist, 'radius:', node.radius);
                if (dist < node.radius + 15) found = node;
            });

            if (found) {
                console.log('Selected Node:', found);
                onSelectNode(found);
                setDraggingNode({ id: found.id, offsetX: x - found.x, offsetY: y - found.y });
            } else {
                onSelectNode(null);
            }
        };

        const handleMouseMove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (draggingNode) {
                setNodePositions(prev => ({
                    ...prev,
                    [draggingNode.id]: { x: x - draggingNode.offsetX, y: y - draggingNode.offsetY }
                }));
                return;
            }

            let foundHover = null;
            Object.values(nodesRef.current).forEach(node => {
                const dist = Math.sqrt((x - node.x) ** 2 + (y - node.y) ** 2);
                if (dist < node.radius + 15) {
                    foundHover = node;
                }
            });
            setHoverNode(foundHover);
        };

        const handleMouseUp = () => {
            setDraggingNode(null);
        };

        window.addEventListener('resize', updateNodes);
        canvas.addEventListener('mousedown', handleClick);
        canvas.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        updateNodes();

        const draw = () => {
            ctx.fillStyle = '#050505';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            // Draw Connection Lines
            Object.values(nodesRef.current).forEach(node => {
                if (node.id === 'router') return;
                if (!nodesRef.current.router) return;

                const isSelected = selectedNode?.id === node.id || selectedNode?.id === 'router';
                const isBlocked = blockedIps.includes(node.ip);

                ctx.beginPath();
                ctx.setLineDash(isBlocked ? [2, 4] : [5, 8]);
                ctx.strokeStyle = isBlocked ? 'rgba(239, 68, 68, 0.2)' : (isSelected ? addAlpha(node.color, '66') : 'rgba(255, 255, 255, 0.05)');
                ctx.lineWidth = isSelected ? 1.5 : 1;
                ctx.moveTo(node.x, node.y);
                ctx.lineTo(nodesRef.current.router.x, nodesRef.current.router.y);
                ctx.stroke();
                ctx.setLineDash([]);
            });

            // Draw Nodes
            Object.values(nodesRef.current).forEach(node => {
                const isSelected = selectedNode?.id === node.id;
                const isBlocked = blockedIps.includes(node.ip);

                // Outer Glow - Sharpened
                const grad = ctx.createRadialGradient(node.x, node.y, node.radius, node.x, node.y, node.radius * 1.5);
                const glowBase = isBlocked ? '#ef4444' : node.color;
                grad.addColorStop(0, addAlpha(glowBase, isSelected ? '44' : (isBlocked ? '22' : '11')));
                grad.addColorStop(1, 'transparent');
                ctx.fillStyle = grad;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius * 1.5, 0, Math.PI * 2);
                ctx.fill();

                // Core
                ctx.fillStyle = isBlocked ? '#ef4444' : (isSelected ? '#fff' : node.color);
                ctx.beginPath();
                ctx.arc(node.x, node.y, isSelected ? 5 : 4, 0, Math.PI * 2);
                ctx.fill();

                // Blocked Indicator (X)
                if (isBlocked) {
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1.5;
                    ctx.beginPath();
                    const crossSize = 2.5;
                    ctx.moveTo(node.x - crossSize, node.y - crossSize);
                    ctx.lineTo(node.x + crossSize, node.y + crossSize);
                    ctx.moveTo(node.x + crossSize, node.y - crossSize);
                    ctx.lineTo(node.x - crossSize, node.y + crossSize);
                    ctx.stroke();
                }

                // Ring - Sharper border
                ctx.strokeStyle = isBlocked ? '#ef4444' : node.color;
                ctx.lineWidth = isBlocked ? 2.5 : 1.5;
                ctx.beginPath();
                ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
                ctx.stroke();

                // Combined Label Rendering
                const isClient = node.type !== 'router' && node.type !== 'app';

                if (isClient) {
                    // LEFT SIDE LABELS for client devices
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';

                    // Primary Friendly Name (e.g. 'Galaxy S24', 'MacBook Pro')
                    ctx.font = '700 11px Inter';
                    ctx.fillStyle = isSelected ? '#fff' : 'rgba(255, 255, 255, 0.9)';
                    ctx.fillText(node.label.toUpperCase(), node.x - node.radius - 15, node.y - 10);

                    // Technical name subtitle (e.g. 'Apple-254')
                    if (node.techName && node.techName !== node.label) {
                        ctx.font = '400 8px monospace';
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
                        ctx.fillText(node.techName, node.x - node.radius - 15, node.y + 1);
                    }

                    // IP & Connection Type
                    ctx.font = '400 9px monospace';
                    let connColor = node.connectionType === 'wireless' ? 'rgba(96, 165, 250, 0.6)' : 'rgba(148, 163, 184, 0.6)';
                    if (isBlocked) connColor = '#fca5a5';
                    ctx.fillStyle = connColor;
                    const metaText = isBlocked ? `RESTRICTED • ${node.ip}` : `${node.connectionType === 'wireless' ? 'WIFI' : 'ETH'} • ${node.ip}`;
                    ctx.fillText(metaText, node.x - node.radius - 15, node.y + 4);

                    // Usage (Signal Mode special)
                    if (visualMode === 'usage') {
                        const usage = usageStats[node.ip] || 0;
                        ctx.font = '700 10px Inter';
                        ctx.fillStyle = usage > 0 ? '#a855f7' : 'rgba(255,255,255,0.2)';
                        ctx.fillText(`${(usage / 1024).toFixed(1)} KB`, node.x - node.radius - 15, node.y + 16);
                    } else if (visualMode === 'signal' && node.connectionType === 'wireless') {
                        ctx.font = '700 10px Inter';
                        ctx.fillStyle = node.color;
                        ctx.fillText(`SIGNAL: ${node.signal}`, node.x - node.radius - 15, node.y + 16);
                    } else if (visualMode === 'uptime') {
                        ctx.font = '700 10px Inter';
                        ctx.fillStyle = '#60a5fa'; // Blue for time
                        ctx.fillText(`UPTIME: ${node.uptime || '0h 0m'}`, node.x - node.radius - 15, node.y + 16);
                    }
                } else {
                    // CENTER/BOTTOM LABELS for Gateway and Apps
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'top';

                    ctx.font = '700 11px Inter';
                    ctx.fillStyle = '#fff';
                    ctx.fillText(node.label.toUpperCase(), node.x, node.y + node.radius + 12);

                    if (node.ssid) {
                        ctx.font = '700 12px monospace';
                        ctx.fillStyle = '#10b981';
                        ctx.fillText(node.ssid, node.x, node.y - node.radius - 25);

                        // Gateway Waves
                        const waveTime = Date.now() / 1500;
                        for (let i = 0; i < 2; i++) {
                            const waveR = node.radius + ((waveTime + i * 0.7) % 1.5) * 35;
                            const opacity = 1 - ((waveTime + i * 0.7) % 1.5) / 1.5;
                            ctx.strokeStyle = `rgba(16, 185, 129, ${opacity * 0.2})`;
                            ctx.lineWidth = 1;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, waveR, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    }
                }

                // Signal Waves for Visual Mode (Always keep as they are visual highlights)
                if (visualMode === 'signal' && isClient && node.connectionType === 'wireless') {
                    const signalVal = Math.abs(parseInt(node.signal?.replace(/[^-0-9]/g, '') || '-100'));
                    if (signalVal > 60) {
                        const waveTime = Date.now() / (signalVal > 75 ? 800 : 1200);
                        const color = signalVal > 75 ? '239, 68, 68' : '245, 158, 11';
                        for (let i = 0; i < 3; i++) {
                            const waveR = node.radius + ((waveTime + i * 0.5) % 1.5) * 50;
                            const opacity = 0.6 * (1 - ((waveTime + i * 0.5) % 1.5) / 1.5);
                            ctx.strokeStyle = `rgba(${color}, ${opacity})`;
                            ctx.lineWidth = signalVal > 75 ? 2 : 1;
                            ctx.beginPath();
                            ctx.arc(node.x, node.y, waveR, 0, Math.PI * 2);
                            ctx.stroke();
                        }
                    }
                }

                // Hover State Overlay
                if (hoverNode?.id === node.id || isSelected) {
                    ctx.strokeStyle = '#fff';
                    ctx.setLineDash([2, 4]);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });

            // Tooltip Rendering
            if (hoverNode) {
                const tooltipX = Math.min(hoverNode.x + 20, window.innerWidth - 180);
                const tooltipY = Math.min(hoverNode.y + 20, window.innerHeight - 100);

                // Shadow
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';

                ctx.fillStyle = 'rgba(10, 10, 15, 0.95)';
                ctx.strokeStyle = 'rgba(255,255,255,0.1)';
                ctx.beginPath();
                ctx.roundRect(tooltipX, tooltipY, 160, 80, 8);
                ctx.fill();
                ctx.stroke();

                ctx.shadowBlur = 0;

                ctx.fillStyle = '#fff';
                ctx.font = '700 11px Inter';
                ctx.fillText(hoverNode.label, tooltipX + 10, tooltipY + 22);

                ctx.fillStyle = 'rgba(255,255,255,0.4)';
                ctx.font = '500 9px monospace';
                ctx.fillText(hoverNode.vendor || 'Unknown Hardware', tooltipX + 10, tooltipY + 38);
                ctx.fillText(`MAC: ${hoverNode.mac || '??:??:??'}`, tooltipX + 10, tooltipY + 50);

                if (hoverNode.connectionType === 'wireless') {
                    ctx.fillStyle = '#34d399';
                    ctx.fillText(`SIGNAL: ${hoverNode.signal || 'N/A'}`, tooltipX + 10, tooltipY + 68);
                } else if (hoverNode.connectionType === 'wired') {
                    ctx.fillStyle = '#60a5fa';
                    ctx.fillText('CONNECTION: WIRED', tooltipX + 10, tooltipY + 68);
                }
            }

            // Update/Draw Particles
            particles.current = particles.current.filter(p => p.life > 0);
            particles.current.forEach(p => {
                p.life -= 0.008;
                p.progress += p.speed;

                ctx.fillStyle = p.color;
                const x = p.startNode.x + (p.endNode.x - p.startNode.x) * p.progress;
                const y = p.startNode.y + (p.endNode.y - p.startNode.y) * p.progress;

                ctx.beginPath();
                ctx.arc(x, y, 1.2, 0, Math.PI * 2); // Slightly smaller
                ctx.fill();

                if (p.life > 0.5) {
                    ctx.shadowBlur = 4; // Less glow
                    ctx.shadowColor = p.color;
                }
            });
            ctx.shadowBlur = 0;

            animationId = requestAnimationFrame(draw);
        };

        draw();
        return () => {
            cancelAnimationFrame(animationId);
            window.removeEventListener('resize', updateNodes);
            canvas.removeEventListener('mousedown', handleClick);
            if (canvas) canvas.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [devices, selectedNode, onSelectNode, visualMode, usageStats, nodePositions, draggingNode]);

    // Spawn particles
    useEffect(() => {
        if (packets.length > 0) {
            const p = packets[0];
            const sourceNode = nodesRef.current[p.src];
            const routerNode = nodesRef.current['router'];

            // App node based on port
            let appNodeId = 'web';
            if (p.destPort === 53) appNodeId = 'dns';
            else if ([3478, 5228].includes(p.destPort)) appNodeId = 'voip';
            const appNode = nodesRef.current[appNodeId];

            if (sourceNode && routerNode) {
                // Device -> Router
                particles.current.push({
                    startNode: sourceNode,
                    endNode: routerNode,
                    progress: 0,
                    speed: 0.015 + Math.random() * 0.01,
                    life: 1,
                    color: sourceNode.color
                });

                // Router -> App
                if (appNode) {
                    setTimeout(() => {
                        particles.current.push({
                            startNode: routerNode,
                            endNode: appNode,
                            progress: 0,
                            speed: 0.015 + Math.random() * 0.01,
                            life: 1,
                            color: appNode.color
                        });
                    }, 600);
                }
            }
        }
    }, [packets]);

    return (
        <canvas
            ref={canvasRef}
            className={`w-full h-full block ${draggingNode ? 'cursor-grabbing' : hoverNode ? 'cursor-grab' : 'cursor-default'}`}
        />
    );
};

export default Visualizer;
