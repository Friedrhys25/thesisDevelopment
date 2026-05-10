import { Ionicons } from "@expo/vector-icons";
import { collection, doc, onSnapshot, orderBy, query } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Dimensions, Easing, KeyboardAvoidingView, Platform, Pressable, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGrad, Path, Rect, Stop, Text as SvgText } from "react-native-svg";
import { auth, firestore } from "../../backend/firebaseConfig";

interface HistoryEntry { complaintKey: string; type: string; incidentPurok: string; deployedAt: string; resolvedAt: string; status: string; }

// Light theme — same accent palette
const C = {
  bg: "#F8FAFC", surface: "#FFFFFF", surfaceAlt: "#F1F5F9", elevated: "#E2E8F0",
  text: "#0F172A", textMuted: "#64748B", textDim: "#94A3B8",
  gold: "#D97706", goldLight: "#F59E0B", goldDim: "rgba(217,119,6,0.08)", goldBorder: "rgba(217,119,6,0.2)",
  blue: "#1447c0", blueMid: "#2563EB", blueLight: "rgba(37,99,235,0.08)",
  red: "#DC2626", success: "#059669", successDim: "rgba(5,150,105,0.08)",
  border: "#E2E8F0", borderStrong: "#CBD5E1",
};

// ─── ANIMATED BAR ───
function AnimBar({ x, width, height, maxH, color, delay, label, value }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setProgress(v));
    Animated.timing(anim, { toValue: 1, duration: 800, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [height]);
  const curH = height * progress;
  return (
    <G>
      <Defs><SvgGrad id={`b${x}`} x1="0" y1="0" x2="0" y2="1"><Stop offset="0" stopColor={color} stopOpacity="1" /><Stop offset="1" stopColor={color} stopOpacity="0.5" /></SvgGrad></Defs>
      <Rect x={x} y={maxH - curH} width={width} height={Math.max(curH, 0)} rx={6} fill={`url(#b${x})`} />
      <SvgText x={x + width / 2} y={maxH + 18} fill={C.textMuted} fontSize="10" fontWeight="700" textAnchor="middle">{label}</SvgText>
      {progress > 0.5 && <SvgText x={x + width / 2} y={maxH - height - 8} fill={C.text} fontSize="12" fontWeight="800" textAnchor="middle">{value}</SvgText>}
    </G>
  );
}

function AnimatedBarChart({ labels, values, color, width: cw }: any) {
  const maxVal = Math.max(...values, 1);
  const ch = 170;
  const bw = Math.min(32, (cw - 60) / labels.length - 12);
  const gap = (cw - 40 - bw * labels.length) / (labels.length + 1);
  return (
    <Svg width={cw} height={ch + 28}>
      <Line x1={20} y1={ch} x2={cw - 20} y2={ch} stroke={C.border} strokeWidth={1} />
      {labels.map((lbl: string, i: number) => {
        const h = (values[i] / maxVal) * (ch - 28);
        return <AnimBar key={`${lbl}-${i}`} x={20 + gap + i * (bw + gap)} width={bw} height={h} maxH={ch} color={color} delay={i * 120} label={lbl} value={values[i]} />;
      })}
    </Svg>
  );
}

// ─── ANIMATED AREA CHART ───
function AnimatedAreaChart({ labels, values, color, width: cw }: any) {
  const maxVal = Math.max(...values, 1);
  const ch = 170;
  const padX = 30;
  const padTop = 20;
  const anim = useRef(new Animated.Value(0)).current;
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value: v }) => setProgress(v));
    Animated.timing(anim, { toValue: 1, duration: 1200, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [values.join(",")]);

  const stepX = (cw - padX * 2) / Math.max(labels.length - 1, 1);
  const points = values.map((v: number, i: number) => {
    const x = padX + i * stepX;
    const rawY = ch - (v / maxVal) * (ch - padTop);
    const y = ch - (ch - rawY) * progress; // animate from baseline
    return { x, y };
  });

  // Line path
  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const cp1x = points[i - 1].x + stepX * 0.4;
    const cp2x = points[i].x - stepX * 0.4;
    linePath += ` C ${cp1x} ${points[i - 1].y} ${cp2x} ${points[i].y} ${points[i].x} ${points[i].y}`;
  }

  // Fill path (close to bottom)
  const fillPath = linePath + ` L ${points[points.length - 1].x} ${ch} L ${points[0].x} ${ch} Z`;

  return (
    <Svg width={cw} height={ch + 28}>
      <Defs>
        <SvgGrad id="areaFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.25" />
          <Stop offset="1" stopColor={color} stopOpacity="0.02" />
        </SvgGrad>
      </Defs>
      {/* Grid lines */}
      {[0.25, 0.5, 0.75].map(f => (
        <Line key={f} x1={padX} y1={ch - (ch - padTop) * f} x2={cw - padX} y2={ch - (ch - padTop) * f} stroke={C.border} strokeWidth={1} strokeDasharray="4,4" />
      ))}
      <Line x1={padX} y1={ch} x2={cw - padX} y2={ch} stroke={C.borderStrong} strokeWidth={1} />
      {/* Area fill */}
      <Path d={fillPath} fill="url(#areaFill)" />
      {/* Line */}
      <Path d={linePath} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots + labels */}
      {points.map((p: any, i: number) => (
        <G key={i}>
          <Circle cx={p.x} cy={p.y} r={5} fill={C.surface} stroke={color} strokeWidth={2.5} />
          {progress > 0.5 && <SvgText x={p.x} y={p.y - 12} fill={C.text} fontSize="11" fontWeight="800" textAnchor="middle">{values[i]}</SvgText>}
          <SvgText x={p.x} y={ch + 16} fill={C.textMuted} fontSize="10" fontWeight="700" textAnchor="middle">{labels[i]}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

// ─── DONUT ───
function DonutSegment({ cx, cy, r, strokeW, circ, dashLen, dashOff, color, delay }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const [curDash, setCurDash] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setCurDash(v * dashLen));
    Animated.timing(anim, { toValue: 1, duration: 900, delay, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [dashLen]);
  return <Circle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={strokeW} fill="none" strokeDasharray={`${curDash}, ${circ}`} strokeDashoffset={-dashOff} strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`} />;
}

function DonutChart({ data, colors, size }: { data: { label: string; value: number }[]; colors: string[]; size: number }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <Text style={{ color: C.textMuted, textAlign: "center", padding: 30 }}>No data</Text>;
  const r = size / 2 - 18; const cx = size / 2; const cy = size / 2; const strokeW = 20; const circ = 2 * Math.PI * r;
  let offset = 0;
  const segs = data.map((d, i) => { const pct = d.value / total; const dl = circ * pct; const off = circ * offset; offset += pct; return { ...d, dashLen: dl, dashOff: off, color: colors[i % colors.length], delay: i * 200 }; });
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size}>
        <Circle cx={cx} cy={cy} r={r} stroke={C.border} strokeWidth={strokeW} fill="none" />
        {segs.map(seg => <DonutSegment key={seg.label} cx={cx} cy={cy} r={r} strokeW={strokeW} circ={circ} dashLen={seg.dashLen} dashOff={seg.dashOff} color={seg.color} delay={seg.delay} />)}
        <SvgText x={cx} y={cy - 4} fill={C.text} fontSize="26" fontWeight="900" textAnchor="middle">{total}</SvgText>
        <SvgText x={cx} y={cy + 14} fill={C.textMuted} fontSize="10" fontWeight="700" textAnchor="middle">TOTAL</SvgText>
      </Svg>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, marginTop: 16 }}>
        {data.map((d, i) => (
          <View key={d.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors[i % colors.length] }} />
            <Text style={{ color: C.textMuted, fontSize: 12, fontWeight: "700" }}>{d.label}</Text>
            <Text style={{ color: C.text, fontSize: 13, fontWeight: "900" }}>{d.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── ANIMATED STAT ───
function AnimStat({ icon, value, label, color }: any) {
  const anim = useRef(new Animated.Value(0)).current;
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration: 1000, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [value]);
  const scale = useRef(new Animated.Value(0.85)).current;
  useEffect(() => { Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[st.statBox, { transform: [{ scale }] }]}>
      <View style={[st.statIcon, { backgroundColor: color + "12" }]}><Ionicons name={icon} size={20} color={color} /></View>
      <Text style={[st.statValue, { color }]}>{display}</Text>
      <Text style={st.statLabel}>{label}</Text>
    </Animated.View>
  );
}

// ─── MAIN ───
export default function Reports() {
  const insets = useSafeAreaInsets();
  const sw = Dimensions.get("window").width;
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [activeCount, setActiveCount] = useState(0);
  const [viewMode, setViewMode] = useState<"reports" | "analytics">("analytics");
  const [expandedCard, setExpandedCard] = useState<number | null>(null);
  const [chartType, setChartType] = useState<"bar" | "area">("area");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) { setLoading(false); return; }
    const unsubT = onSnapshot(doc(firestore, "employee", user.uid), (snap) => { if (snap.exists()) setActiveCount(snap.data().deploymentStatus === "deployed" ? 1 : 0); });
    const unsubH = onSnapshot(query(collection(firestore, "employee", user.uid, "deploymentHistory"), orderBy("resolvedAt", "desc")), (snap) => { setHistory(snap.docs.map(d => d.data() as HistoryEntry)); setLoading(false); });
    return () => { unsubT(); unsubH(); };
  }, []);

  const resolved = history.filter(h => h.status === "resolved");
  const totalCount = history.length + activeCount;

  const purokCounts: Record<string, number> = {};
  history.forEach(e => { purokCounts[e.incidentPurok || "?"] = (purokCounts[e.incidentPurok || "?"] || 0) + 1; });
  const purokLabels = Object.keys(purokCounts).sort();
  const purokValues = purokLabels.map(p => purokCounts[p]);

  const typeCounts: Record<string, number> = {};
  history.forEach(e => { typeCounts[e.type || "Other"] = (typeCounts[e.type || "Other"] || 0) + 1; });
  const typeData = Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

  const now = new Date();
  const weeklyData = [0, 0, 0, 0];
  const weekLabels = ["4w ago", "3w ago", "2w ago", "Now"];
  history.forEach(e => { if (!e.resolvedAt) return; const w = Math.floor((now.getTime() - new Date(e.resolvedAt).getTime()) / 604800000); if (w < 4) weeklyData[3 - w]++; });

  const chartW = sw - 76;
  const typeColors = [C.gold, C.blueMid, C.success, C.red, "#7C3AED", "#0891B2", "#EA580C", "#6366F1"];

  if (loading) return (
    <SafeAreaView style={st.safe}><StatusBar barStyle="dark-content" /><View style={st.center}><ActivityIndicator size="large" color={C.gold} /></View></SafeAreaView>
  );

  return (
    <SafeAreaView style={st.safe} edges={["left", "right"]}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {/* Header */}
        <View style={[st.header, { paddingTop: insets.top + 14 }]}>
          <Text style={st.eyebrow}>OVERVIEW</Text>
          <Text style={st.title}>Reports & Analytics</Text>
          <Text style={st.subtitle}>Interactive charts · Live data</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }} showsVerticalScrollIndicator={false}>
          {/* Tabs */}
          <View style={st.tabRow}>
            {(["reports", "analytics"] as const).map(m => (
              <TouchableOpacity key={m} style={[st.tab, viewMode === m && st.tabActive]} onPress={() => setViewMode(m)}>
                <Ionicons name={m === "reports" ? "document-text" : "pie-chart"} size={14} color={viewMode === m ? "#FFF" : C.textMuted} />
                <Text style={[st.tabText, viewMode === m && st.tabTextActive]}>{m === "reports" ? "History" : "Analytics"}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {viewMode === "reports" ? (
            <View style={st.section}>
              <Text style={st.secEye}>DEPLOYMENT LOGS</Text>
              <Text style={st.secTitle}>Resolved History</Text>
              <Text style={st.secSubtitle}>{resolved.length} resolved deployment{resolved.length !== 1 ? "s" : ""}</Text>
              {resolved.length === 0 && <View style={st.emptyWrap}><Ionicons name="document-text-outline" size={40} color={C.textDim} /><Text style={st.emptyText}>No resolved entries yet</Text></View>}
              {resolved.map((e, i) => {
                const deployed = e.deployedAt ? new Date(e.deployedAt) : null;
                const resolvedAt = e.resolvedAt ? new Date(e.resolvedAt) : null;
                let duration = "N/A";
                if (deployed && resolvedAt) {
                  const diffMin = Math.round((resolvedAt.getTime() - deployed.getTime()) / 60000);
                  if (diffMin < 60) duration = `${diffMin}m`;
                  else if (diffMin < 1440) duration = `${Math.floor(diffMin / 60)}h ${diffMin % 60}m`;
                  else duration = `${Math.floor(diffMin / 1440)}d ${Math.floor((diffMin % 1440) / 60)}h`;
                }
                return (
                  <Pressable key={i} onPress={() => setExpandedCard(expandedCard === i ? null : i)} style={[st.histCard, expandedCard === i && st.histCardActive]}>
                    <View style={st.histTop}>
                      <View style={st.histBadge}><Ionicons name="checkmark" size={14} color={C.success} /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={st.histType}>{e.type}</Text>
                        <Text style={st.histPurok}>Purok {e.incidentPurok}</Text>
                      </View>
                      <View style={st.durationPill}><Ionicons name="time-outline" size={12} color={C.blueMid} /><Text style={st.durationText}>{duration}</Text></View>
                      <Ionicons name={expandedCard === i ? "chevron-up" : "chevron-down"} size={18} color={C.textDim} />
                    </View>
                    {expandedCard === i && (
                      <View style={st.histExpand}>
                        <View style={st.histRow}><Ionicons name="key-outline" size={14} color={C.textDim} /><Text style={st.histLabel}>Complaint ID</Text><Text style={st.histVal}>{e.complaintKey || "N/A"}</Text></View>
                        <View style={st.histRow}><Ionicons name="alert-circle-outline" size={14} color={C.gold} /><Text style={st.histLabel}>Type</Text><Text style={st.histVal}>{e.type}</Text></View>
                        <View style={st.histRow}><Ionicons name="location-outline" size={14} color={C.success} /><Text style={st.histLabel}>Location</Text><Text style={st.histVal}>Purok {e.incidentPurok}</Text></View>
                        <View style={st.histDivider} />
                        <View style={st.histRow}><Ionicons name="arrow-forward-circle" size={14} color={C.gold} /><Text style={st.histLabel}>Deployed</Text><Text style={st.histVal}>{deployed ? deployed.toLocaleString() : "N/A"}</Text></View>
                        <View style={st.histRow}><Ionicons name="checkmark-circle" size={14} color={C.success} /><Text style={st.histLabel}>Resolved</Text><Text style={st.histVal}>{resolvedAt ? resolvedAt.toLocaleString() : "N/A"}</Text></View>
                        <View style={st.histRow}><Ionicons name="timer-outline" size={14} color={C.blueMid} /><Text style={st.histLabel}>Duration</Text><Text style={[st.histVal, { color: C.blueMid, fontWeight: "900" }]}>{duration}</Text></View>
                        <View style={st.histStatusRow}>
                          <View style={st.histStatusBadge}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: C.success }} /><Text style={st.histStatusText}>Resolved</Text></View>
                        </View>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <>
              {/* Stats */}
              <View style={st.section}>
                <Text style={st.secEye}>PERFORMANCE</Text>
                <Text style={st.secTitle}>Summary</Text>
                <View style={st.statsRow}>
                  <AnimStat icon="layers" value={totalCount} label="Total" color={C.blueMid} />
                  <AnimStat icon="checkmark-done" value={resolved.length} label="Resolved" color={C.success} />
                  <AnimStat icon="pulse" value={activeCount} label="Active" color={C.gold} />
                </View>
              </View>

              {/* Chart type toggle */}
              <View style={st.section}>
                <Text style={st.secEye}>CHART MODE</Text>
                <View style={st.chartToggleRow}>
                  <TouchableOpacity style={[st.chartToggle, chartType === "area" && st.chartToggleActive]} onPress={() => setChartType("area")}>
                    <Ionicons name="trending-up" size={16} color={chartType === "area" ? "#FFF" : C.textMuted} />
                    <Text style={[st.chartToggleText, chartType === "area" && st.chartToggleTextActive]}>Area</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[st.chartToggle, chartType === "bar" && st.chartToggleActive]} onPress={() => setChartType("bar")}>
                    <Ionicons name="bar-chart" size={16} color={chartType === "bar" ? "#FFF" : C.textMuted} />
                    <Text style={[st.chartToggleText, chartType === "bar" && st.chartToggleTextActive]}>Bar</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Weekly trends */}
              <View style={st.section}>
                <Text style={st.secEye}>TRENDS</Text>
                <Text style={st.secTitle}>Weekly Activity</Text>
                <View style={st.chartCard}>
                  {weeklyData.some(v => v > 0) ? (
                    chartType === "area"
                      ? <AnimatedAreaChart labels={weekLabels} values={weeklyData} color={C.blueMid} width={chartW} />
                      : <AnimatedBarChart labels={weekLabels} values={weeklyData} color={C.blueMid} width={chartW} />
                  ) : <Text style={st.noData}>No data for the last 4 weeks</Text>}
                </View>
              </View>

              {/* Purok */}
              <View style={st.section}>
                <Text style={st.secEye}>LOCATIONS</Text>
                <Text style={st.secTitle}>Complaints by Purok</Text>
                <View style={st.chartCard}>
                  {purokLabels.length > 0 ? (
                    <>
                      {chartType === "area"
                        ? <AnimatedAreaChart labels={purokLabels.map(p => `P${p}`)} values={purokValues} color={C.success} width={chartW} />
                        : <AnimatedBarChart labels={purokLabels.map(p => `P${p}`)} values={purokValues} color={C.success} width={chartW} />}
                      <View style={st.purokList}>
                        {purokLabels.map(p => (
                          <View key={p} style={st.purokRow}>
                            <View style={[st.dot, { backgroundColor: C.success }]} />
                            <Text style={st.purokLabel}>Purok {p}</Text>
                            <Text style={st.purokVal}>{purokCounts[p]}</Text>
                          </View>
                        ))}
                      </View>
                    </>
                  ) : <Text style={st.noData}>No purok data</Text>}
                </View>
              </View>

              {/* Donut: types */}
              <View style={st.section}>
                <Text style={st.secEye}>BREAKDOWN</Text>
                <Text style={st.secTitle}>Complaint Types</Text>
                <View style={st.chartCard}>
                  {typeData.length > 0 ? <DonutChart data={typeData} colors={typeColors} size={200} /> : <Text style={st.noData}>No complaint data</Text>}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 22, paddingBottom: 18, backgroundColor: C.surface, borderBottomWidth: 1, borderBottomColor: C.border },
  eyebrow: { color: C.gold, fontSize: 10, fontWeight: "900", letterSpacing: 2, marginBottom: 4 },
  title: { fontSize: 26, fontWeight: "900", color: C.text, letterSpacing: -0.5, marginBottom: 4 },
  subtitle: { fontSize: 13, color: C.textMuted, fontWeight: "600" },

  tabRow: { flexDirection: "row", marginHorizontal: 18, marginTop: 18, backgroundColor: C.surfaceAlt, borderRadius: 14, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 12 },
  tabActive: { backgroundColor: C.text },
  tabText: { fontSize: 12, fontWeight: "800", letterSpacing: 1, color: C.textMuted, textTransform: "uppercase" },
  tabTextActive: { color: "#FFF" },

  section: { paddingHorizontal: 18, marginTop: 24 },
  secEye: { color: C.textDim, fontSize: 9, fontWeight: "900", letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 2 },
  secTitle: { color: C.text, fontSize: 18, fontWeight: "900", marginBottom: 14 },

  statsRow: { flexDirection: "row", gap: 10 },
  statBox: { flex: 1, backgroundColor: C.surface, borderRadius: 20, padding: 16, alignItems: "center", borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  statIcon: { width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statValue: { fontSize: 28, fontWeight: "900", marginTop: 4 },
  statLabel: { fontSize: 9, color: C.textMuted, marginTop: 4, fontWeight: "800", textTransform: "uppercase", letterSpacing: 1.5 },

  chartCard: { backgroundColor: C.surface, borderRadius: 22, padding: 18, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  noData: { color: C.textMuted, fontSize: 14, paddingVertical: 30, textAlign: "center", fontWeight: "600" },

  purokList: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: C.border },
  purokRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  purokLabel: { flex: 1, fontSize: 14, color: C.textMuted, fontWeight: "600" },
  purokVal: { fontSize: 14, fontWeight: "900", color: C.text },

  emptyWrap: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: C.textMuted, marginTop: 12, fontSize: 14, fontWeight: "600" },

  histCard: { backgroundColor: C.surface, borderRadius: 18, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: C.border, shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  histCardActive: { borderColor: C.goldBorder },
  histTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  histBadge: { width: 32, height: 32, borderRadius: 10, backgroundColor: C.successDim, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(5,150,105,0.2)" },
  histType: { fontSize: 15, fontWeight: "800", color: C.text },
  histPurok: { fontSize: 12, fontWeight: "600", color: C.textMuted, marginTop: 2 },
  durationPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: C.blueLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  durationText: { fontSize: 11, fontWeight: "800", color: C.blueMid },
  histExpand: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.border, gap: 10 },
  histRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  histLabel: { flex: 1, fontSize: 12, fontWeight: "700", color: C.textMuted },
  histVal: { fontSize: 13, fontWeight: "700", color: C.text, maxWidth: "55%", textAlign: "right" },
  histDetail: { fontSize: 13, color: C.textMuted, fontWeight: "600" },
  histDivider: { height: 1, backgroundColor: C.border, marginVertical: 4 },
  histStatusRow: { flexDirection: "row", marginTop: 4 },
  histStatusBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: C.successDim, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: "rgba(5,150,105,0.2)" },
  histStatusText: { fontSize: 11, fontWeight: "800", color: C.success, textTransform: "uppercase", letterSpacing: 1 },
  secSubtitle: { fontSize: 13, color: C.textMuted, fontWeight: "600", marginTop: -10, marginBottom: 14 },
  chartToggleRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  chartToggle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: C.border, backgroundColor: C.surfaceAlt },
  chartToggleActive: { backgroundColor: C.text, borderColor: C.text },
  chartToggleText: { fontSize: 13, fontWeight: "800", color: C.textMuted, textTransform: "uppercase", letterSpacing: 1 },
  chartToggleTextActive: { color: "#FFF" },
});
