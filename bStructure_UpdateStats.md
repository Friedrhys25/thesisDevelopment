// Notiftable.jsx
// Flow: pending → deploy tanods (min 2) → in-progress → Mark as Resolved (direct, no feedback input)
// Admin views citizen-submitted feedback via "View Feedback" button on resolved complaints
// On deploy:  sets deploymentStatus & deployedTo (with coDeployedTanods) on each tanod,
//             sets deployedTanods array + deployedTanodUid/Name on complaint
// On resolve: clears all tanods' deployment, updates complaint status to "resolved"
import React, { useState, useEffect, useMemo } from "react";
import {
  FiAlertTriangle, FiClock, FiSearch, FiX,
  FiUser, FiMapPin, FiFileText, FiCalendar,
  FiCheckCircle, FiHome, FiShield, FiStar,
  FiChevronLeft, FiChevronRight,
} from "react-icons/fi";
import {
  collection, onSnapshot, doc, updateDoc,
  getDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { firestore } from "../../firebaseConfig";

// ── Persisted seen-feedback keys ──────────────────────────────────────────────
const SEEN_KEY = "seenFeedbackKeys";
const loadSeenKeys = () => {
  try { return new Set(JSON.parse(localStorage.getItem(SEEN_KEY) || "[]")); }
  catch { return new Set(); }
};
const saveSeenKey = (key) => {
  try {
    const s = loadSeenKeys(); s.add(key);
    localStorage.setItem(SEEN_KEY, JSON.stringify([...s]));
  } catch {}
};

// ── Read-only Star display ────────────────────────────────────────────────────
const StarDisplay = ({ value = 0, size = 22 }) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <FiStar
        key={n}
        size={size}
        className={n <= value ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}
      />
    ))}
  </div>
);

const ratingLabel = (r) =>
  ["", "Poor", "Fair", "Good", "Very Good", "Excellent"][r] || "";



// ── Confirm Resolve Modal ─────────────────────────────────────────────────────
const ConfirmResolveModal = ({ complaint, onConfirm, onCancel, resolving }) => {
  if (!complaint) return null;
  return (
    <div
      className="fixed inset-0 z-60 p-4 bg-black/50 backdrop-blur-sm flex items-center justify-center"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-linear-to-r from-green-600 to-emerald-600 px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3 text-white">
            <div className="bg-white/20 p-2.5 rounded-xl"><FiCheckCircle size={20} /></div>
            <div>
              <h3 className="text-lg font-extrabold">Mark as Resolved</h3>
              <p className="text-green-100 text-xs font-semibold mt-0.5">Confirm resolution of this complaint</p>
            </div>
          </div>
          <button
            className="text-white/80 hover:text-white hover:bg-white/15 rounded-full p-2 transition"
            onClick={onCancel}
          >
            <FiX size={20} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="rounded-xl border border-green-100 bg-green-50 px-4 py-3">
            <p className="text-xs font-extrabold text-green-700 uppercase tracking-wider">Complaint</p>
            <p className="text-sm font-bold text-gray-800 mt-1 line-clamp-2">{complaint.message || "—"}</p>
            <p className="text-xs text-gray-500 font-semibold mt-0.5">
              by {complaint.name} · Purok {complaint.incidentPurok}
            </p>
          </div>

          {complaint.deployedTanods && complaint.deployedTanods.length > 0 ? (
            <div className="space-y-2">
              {complaint.deployedTanods.map((t) => (
                <div key={t.uid} className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <div className="bg-indigo-600 text-white p-2 rounded-xl shrink-0"><FiShield size={15} /></div>
                  <div>
                    <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">Deployed Tanod</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{t.name}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : complaint.deployedTanodName && (
            <div className="flex items-center gap-3 rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
              <div className="bg-indigo-600 text-white p-2 rounded-xl shrink-0"><FiShield size={15} /></div>
              <div>
                <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">Deployed Tanod</p>
                <p className="text-sm font-bold text-gray-800 mt-0.5">{complaint.deployedTanodName}</p>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-600 font-semibold text-center">
            Are you sure you want to mark this complaint as <span className="text-green-700 font-extrabold">Resolved</span>?
          </p>
        </div>

        <div className="border-t px-6 py-4 bg-slate-50 flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={resolving}
            className={`flex-1 py-3 rounded-xl text-white font-extrabold text-sm transition shadow-md ${
              resolving ? "bg-gray-300 cursor-not-allowed" : "bg-green-600 hover:bg-green-700"
            }`}
          >
            {resolving ? "Resolving…" : "Confirm & Resolve ✓"}
          </button>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Notiftable = () => {
  const [filter, setFilter]               = useState("all");
  const [statusFilter, setStatusFilter]   = useState("all");
  const [issueFilter, setIssueFilter]     = useState("all");
  const [searchTerm, setSearchTerm]       = useState("");
  const [notifications, setNotifications] = useState([]);
  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [previewImage, setPreviewImage]   = useState(null);
  const [seenKeys]                        = useState(() => loadSeenKeys());
  const [loading, setLoading]             = useState(true);
  const [startDate, setStartDate]         = useState("");
  const [endDate, setEndDate]             = useState("");
  const [dateError, setDateError]         = useState("");

  // ── Deploy Tanod ─────────────────────────────────────────────────────────
  const [tanods, setTanods]               = useState([]);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployTarget, setDeployTarget]   = useState(null);
  const [selectedTanods, setSelectedTanods] = useState(new Set());
  const [deploying, setDeploying]         = useState(false);
  const [tanodSearch, setTanodSearch]     = useState("");
  const [tanodPage, setTanodPage]         = useState(1);
  const TANODS_PER_PAGE = 5;
  const MIN_TANODS = 2;

  // ── View Feedback (read-only) ─────────────────────────────────────────────
  const [showViewFeedbackModal, setShowViewFeedbackModal] = useState(false);
  const [viewFeedbackData, setViewFeedbackData]           = useState(null);
  const [feedbackLoading, setFeedbackLoading]             = useState(false);

  // ── Confirm Resolve ───────────────────────────────────────────────────────
  const [showConfirmResolve, setShowConfirmResolve] = useState(false);
  const [resolvingComplaint, setResolvingComplaint] = useState(null);
  const [resolving, setResolving]                   = useState(false);

  // ── Fetch tanods (employees) ──────────────────────────────────────────────
  useEffect(() => {
    const unsub = onSnapshot(collection(firestore, "employee"), (snap) => {
      const list = snap.docs.map((d) => ({
        uid: d.id, ...d.data(),
        fullName: [d.data().firstName, d.data().middleName, d.data().lastName]
          .filter(Boolean).join(" ").trim() || "Unknown",
      }));
      list.sort((a, b) => a.fullName.localeCompare(b.fullName));
      setTanods(list);
    });
    return () => unsub();
  }, []);

  // ── Feedback notification dots ─────────────────────────────────────────────
  // Driven by `hasFeedback` flag on complaint docs. No separate listener needed.

  // ── Complaints listener ───────────────────────────────────────────────────
  useEffect(() => {
    const innerUnsubs = [];
    const unsubUsers = onSnapshot(
      collection(firestore, "users"),
      (usersSnap) => {
        setLoading(false);
        usersSnap.forEach((userDoc) => {
          const userData = userDoc.data();
          const userId   = userDoc.id;
          const fullName = [userData.firstName, userData.middleName, userData.lastName]
            .filter(Boolean).join(" ").trim() || "Unknown";
          const unsub = onSnapshot(
            collection(firestore, "users", userId, "userComplaints"),
            (cSnap) => {
              setNotifications((prev) => {
                const rest  = prev.filter((c) => c.userId !== userId);
                const fresh = [];
                cSnap.forEach((cDoc) => {
                  const c = cDoc.data();
                  let timestampStr = "—", rawDate = new Date(0);
                  if (c.timestamp?.toDate) {
                    rawDate = c.timestamp.toDate(); timestampStr = rawDate.toLocaleString();
                  } else if (typeof c.timestamp === "string") {
                    timestampStr = c.timestamp; rawDate = new Date(c.timestamp) || new Date(0);
                  }
                  fresh.push({
                    complaintKey:      cDoc.id, userId,
                    name:              fullName,
                    purok:             userData.purok || "—",
                    address:           userData.address || "—",
                    evidencePhoto:     c.evidencePhoto || null,
                    incidentPurok:     c.incidentPurok || "—",
                    incidentLocation:  c.incidentLocation || "—",
                    message:           c.message || "",
                    label:             c.label || "non-urgent",
                    type:              c.type || "—",
                    status:            c.status || "pending",
                    timestamp:         timestampStr,
                    _rawTimestamp:     rawDate,
                    deployedTanods:    c.deployedTanods   || [],
                    deployedTanodUid:  c.deployedTanodUid  || null,
                    deployedTanodName: c.deployedTanodName || null,
                    hasFeedback:       c.hasFeedback       || false,
                  });
                });
                return [...rest, ...fresh].sort((a, b) => b._rawTimestamp - a._rawTimestamp);
              });
            }
          );
          innerUnsubs.push(unsub);
        });
      },
      (err) => { console.error(err); setLoading(false); }
    );
    return () => { unsubUsers(); innerUnsubs.forEach((u) => u()); };
  }, []);

  // ── Date validation ───────────────────────────────────────────────────────
  const getDateBounds = () => {
    if (!startDate || !endDate) return null;
    const s = new Date(`${startDate}T00:00:00`), e = new Date(`${endDate}T23:59:59`);
    return isNaN(s) || isNaN(e) ? null : { start: s, end: e };
  };
  useEffect(() => {
    if (!startDate && !endDate) { setDateError(""); return; }
    const b = getDateBounds();
    if (!b && (startDate || endDate)) { setDateError("Please select both From and To dates."); return; }
    if (b && b.start > b.end) { setDateError("From date must be earlier than To date."); return; }
    setDateError("");
  }, [startDate, endDate]);

  // ── Derived ───────────────────────────────────────────────────────────────
  const issueTypes = useMemo(() => {
    const set = new Set();
    notifications.forEach((n) => { const t = (n.type || "").trim(); if (t && t !== "—") set.add(t); });
    const arr = Array.from(set);
    const pref = ["medical", "fire", "noise", "waste", "infrastructure"];
    const lm = new Map(arr.map((x) => [x.toLowerCase(), x]));
    return [...pref.map((p) => lm.get(p)).filter(Boolean), ...arr.filter((x) => !pref.includes(x.toLowerCase())).sort()];
  }, [notifications]);

  const filteredNotifications = useMemo(() => {
    const bounds = getDateBounds();
    return notifications.filter((n) => {
      if (filter === "urgent"     && n.label !== "urgent") return false;
      if (filter === "non-urgent" && n.label === "urgent") return false;
      if (statusFilter !== "all"  && n.status !== statusFilter) return false;
      if (issueFilter  !== "all"  && (n.type || "").toLowerCase() !== issueFilter.toLowerCase()) return false;
      const term = searchTerm.toLowerCase();
      if (term && !n.name?.toLowerCase().includes(term) && !n.type?.toLowerCase().includes(term) &&
          !n.message?.toLowerCase().includes(term) && !n.incidentPurok?.toLowerCase().includes(term)) return false;
      if (!dateError && bounds) {
        if (n._rawTimestamp < bounds.start || n._rawTimestamp > bounds.end) return false;
      }
      return true;
    });
  }, [notifications, filter, statusFilter, issueFilter, searchTerm, startDate, endDate, dateError]);

  const stats = useMemo(() => ({
    total:         filteredNotifications.length,
    pending:       filteredNotifications.filter((n) => n.status === "pending").length,
    "in-progress": filteredNotifications.filter((n) => ["in-progress", "in progress"].includes(n.status)).length,
    resolved:      filteredNotifications.filter((n) => n.status === "resolved").length,
  }), [filteredNotifications]);

  // ── Display helpers ───────────────────────────────────────────────────────
  const getUrgencyDisplay = (label) =>
    label === "urgent"
      ? { icon: <FiAlertTriangle className="text-red-600" />,  text: "Urgent",     pill: "bg-red-100 text-red-800 ring-1 ring-red-200"   }
      : { icon: <FiClock         className="text-blue-600" />, text: "Non-Urgent", pill: "bg-blue-100 text-blue-800 ring-1 ring-blue-200" };

  const getIssueColor = (type) => ({
    medical:       "bg-red-100 text-red-800 ring-1 ring-red-200",
    fire:          "bg-orange-100 text-orange-800 ring-1 ring-orange-200",
    noise:         "bg-purple-100 text-purple-800 ring-1 ring-purple-200",
    waste:         "bg-green-100 text-green-800 ring-1 ring-green-200",
    infrastructure:"bg-gray-100 text-gray-800 ring-1 ring-gray-200",
  })[(type || "").toLowerCase()] || "bg-gray-100 text-gray-800 ring-1 ring-gray-200";

  const getStatusDisplay = (status) => ({
    pending:       { pill: "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200", text: "Pending"     },
    "in-progress": { pill: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",       text: "In Progress" },
    "in progress": { pill: "bg-blue-100 text-blue-900 ring-1 ring-blue-200",       text: "In Progress" },
    resolved:      { pill: "bg-green-100 text-green-900 ring-1 ring-green-200",    text: "Resolved"    },
  })[(status || "").toLowerCase()] || { pill: "bg-yellow-100 text-yellow-900 ring-1 ring-yellow-200", text: "Pending" };

  // ── Deploy tanod ───────────────────────────────────────────────────────────
  const openDeployModal = (complaint) => {
    setDeployTarget(complaint);
    setSelectedTanods(new Set());
    setTanodSearch("");
    setTanodPage(1);
    setShowDeployModal(true);
  };

  const toggleTanod = (uid) => {
    setSelectedTanods((prev) => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid);
      else next.add(uid);
      return next;
    });
  };

  const filteredTanods = useMemo(() => {
    const term = tanodSearch.toLowerCase();
    return tanods.filter((t) =>
      !term || t.fullName.toLowerCase().includes(term)
    );
  }, [tanods, tanodSearch]);

  const tanodTotalPages = Math.max(1, Math.ceil(filteredTanods.length / TANODS_PER_PAGE));
  const paginatedTanods = filteredTanods.slice(
    (tanodPage - 1) * TANODS_PER_PAGE,
    tanodPage * TANODS_PER_PAGE
  );

  const confirmDeploy = async () => {
    if (selectedTanods.size < MIN_TANODS || !deployTarget) return;
    setDeploying(true);
    try {
      const selectedArr = [...selectedTanods];
      const deployedTanods = selectedArr.map((uid) => {
        const t = tanods.find((x) => x.uid === uid);
        return { uid, name: t?.fullName || "" };
      });
      const deployedTanodNames = deployedTanods.map((t) => t.name).join(", ");

      // Update complaint: set status to in-progress + deployed tanods array
      await updateDoc(
        doc(firestore, "users", deployTarget.userId, "userComplaints", deployTarget.complaintKey),
        {
          deployedTanods,
          deployedTanodUid: deployedTanods[0].uid,
          deployedTanodName: deployedTanodNames,
          status: "in-progress",
        }
      );

      // Update each tanod: mark as deployed with co-deployed info
      const deployedAt = new Date().toISOString();
      for (const { uid, name } of deployedTanods) {
        const coDeployedTanods = deployedTanods.filter((t) => t.uid !== uid);
        await updateDoc(doc(firestore, "employee", uid), {
          deploymentStatus: "deployed",
          deployedTo: {
            complaintKey:    deployTarget.complaintKey,
            userId:          deployTarget.userId,
            complainantName: deployTarget.name,
            type:            deployTarget.type,
            incidentPurok:   deployTarget.incidentPurok,
            description:     deployTarget.message,
            deployedAt,
            coDeployedTanods,
          },
        });
      }

      const patch = (c) =>
        c.complaintKey === deployTarget.complaintKey
          ? { ...c, deployedTanods, deployedTanodUid: deployedTanods[0].uid, deployedTanodName: deployedTanodNames, status: "in-progress" }
          : c;
      setNotifications((prev) => prev.map(patch));
      setSelectedComplaint((prev) => prev ? patch(prev) : prev);
      setShowDeployModal(false);
      setDeployTarget(null);
      setSelectedTanods(new Set());
    } catch (err) {
      console.error(err);
      alert("Failed to deploy tanods.");
    } finally {
      setDeploying(false);
    }
  };

  // ── Direct resolve (no feedback input from admin) ─────────────────────────
  const openConfirmResolve = (complaint) => {
    setResolvingComplaint(complaint);
    setShowConfirmResolve(true);
  };

  const confirmResolve = async () => {
    if (!resolvingComplaint) return;
    setResolving(true);
    try {
      // Mark complaint as resolved
      await updateDoc(
        doc(firestore, "users", resolvingComplaint.userId, "userComplaints", resolvingComplaint.complaintKey),
        { status: "resolved", resolvedAt: serverTimestamp() }
      );

      // Clear all deployed tanods' deployment status & save to history
      const tanodsToResolve = resolvingComplaint.deployedTanods || [];
      // Fallback for legacy single-tanod complaints
      if (tanodsToResolve.length === 0 && resolvingComplaint.deployedTanodUid) {
        tanodsToResolve.push({ uid: resolvingComplaint.deployedTanodUid, name: resolvingComplaint.deployedTanodName });
      }

      for (const { uid } of tanodsToResolve) {
        const tanodRef = doc(firestore, "employee", uid);
        const tanodSnap = await getDoc(tanodRef);
        const deployedTo = tanodSnap.exists() ? tanodSnap.data().deployedTo : null;

        const coDeployedTanods = tanodsToResolve.filter((t) => t.uid !== uid);

        // Save resolved deployment to history subcollection
        await setDoc(
          doc(firestore, "employee", uid, "deploymentHistory", resolvingComplaint.complaintKey),
          {
            complaintKey:    resolvingComplaint.complaintKey,
            userId:          resolvingComplaint.userId,
            complainantName: resolvingComplaint.name,
            type:            resolvingComplaint.type,
            incidentPurok:   resolvingComplaint.incidentPurok,
            description:     resolvingComplaint.message,
            deployedAt:      deployedTo?.deployedAt || null,
            resolvedAt:      new Date().toISOString(),
            status:          "resolved",
            tanodRating:     null,
            tanodComment:    null,
            coDeployedTanods,
          }
        );

        // Clear current deployment
        await updateDoc(tanodRef, {
          deploymentStatus: "available",
          deployedTo: null,
        });
      }

      const patch = (c) =>
        c.complaintKey === resolvingComplaint.complaintKey
          ? { ...c, status: "resolved" }
          : c;
      setNotifications((prev) => prev.map(patch));
      setSelectedComplaint((prev) => prev ? patch(prev) : prev);
      setShowConfirmResolve(false);
      setResolvingComplaint(null);
    } catch (err) {
      console.error(err);
      alert("Failed to resolve complaint.");
    } finally {
      setResolving(false);
    }
  };

  // ── View citizen-submitted feedback (read from deploymentHistory) ──────────
  const handleViewFeedback = async (complaint) => {
    if (!complaint.deployedTanodUid || !complaint.complaintKey) return;
    setFeedbackLoading(true);
    setViewFeedbackData(null);
    setShowViewFeedbackModal(true);
    try {
      const histDoc = await getDoc(
        doc(firestore, "employee", complaint.deployedTanodUid, "deploymentHistory", complaint.complaintKey)
      );
      setViewFeedbackData(histDoc.exists() ? { id: histDoc.id, ...histDoc.data() } : null);
    } catch {
      setViewFeedbackData(null);
    } finally {
      setFeedbackLoading(false);
    }
    const key = complaint.complaintKey;
    saveSeenKey(key);
    seenKeys.add(key);
  };

  // ── Action button logic ───────────────────────────────────────────────────
  const handleActionClick = (complaint) => {
    if (complaint.status === "pending") openDeployModal(complaint);
    else if (["in-progress", "in progress"].includes(complaint.status)) openConfirmResolve(complaint);
  };

  const actionLabel = (s) =>
    s === "pending"                              ? "Deploy Tanod →"
    : ["in-progress", "in progress"].includes(s) ? "Mark as Resolved"
    : "Resolved ✓";

  const actionBg = (s) =>
    s === "pending"                              ? "bg-blue-600 hover:bg-blue-700"
    : ["in-progress", "in progress"].includes(s) ? "bg-green-600 hover:bg-green-700"
    : "bg-gray-400 cursor-not-allowed";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="relative min-h-screen bg-linear-to-br from-slate-50 via-indigo-50 to-blue-50">
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: 'url("/src/assets/sanroquelogo.png")',
          backgroundPosition: "right 35% center",
          backgroundRepeat: "no-repeat",
          backgroundSize: "49%",
          opacity: 0.15,
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6">

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Total"       value={stats.total}          tone="indigo" />
          <StatCard label="Pending"     value={stats.pending}        tone="yellow" />
          <StatCard label="In Progress" value={stats["in-progress"]} tone="blue"   />
          <StatCard label="Resolved"    value={stats.resolved}       tone="green"  />
        </div>

        {/* Filters */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60">
          <div className="p-5 space-y-4">
            <div className="flex flex-col xl:flex-row gap-4 items-start xl:items-end justify-between">
              <div className="w-full xl:w-[380px]">
                <label className="text-xs font-bold text-gray-700 block mb-1.5">Search</label>
                <div className="relative">
                  <FiSearch className="absolute left-4 top-1/2 text-gray-400 -translate-y-1/2" size={18} />
                  <input
                    type="text"
                    placeholder="Search complaints..."
                    className="w-full pl-11 pr-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-200"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                {[["From", startDate, setStartDate], ["To", endDate, setEndDate]].map(([lbl, val, setter]) => (
                  <div key={lbl} className="flex flex-col w-full sm:w-[200px]">
                    <label className="text-xs font-bold text-gray-700 mb-1.5">
                      {lbl} <span className="text-gray-400 font-normal">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={val}
                      onChange={(e) => setter(e.target.value)}
                      className="px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-200"
                    />
                  </div>
                ))}
                {(startDate || endDate) && (
                  <div className="flex flex-col justify-end">
                    <button
                      onClick={() => { setStartDate(""); setEndDate(""); }}
                      className="px-4 py-3 text-sm font-bold text-gray-500 border border-gray-200 rounded-xl bg-white hover:bg-gray-50 transition"
                    >
                      Clear dates
                    </button>
                  </div>
                )}
              </div>

              <div className="flex flex-col w-full sm:w-[220px]">
                <label className="text-xs font-bold text-gray-700 mb-1.5">Issue Type</label>
                <select
                  value={issueFilter}
                  onChange={(e) => setIssueFilter(e.target.value)}
                  className="px-4 py-3 text-sm font-semibold border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-200"
                >
                  <option value="all">All Types</option>
                  {issueTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>

              <div className="flex gap-2 w-full xl:w-auto">
                {["all", "urgent", "non-urgent"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-4 py-3 rounded-xl text-sm font-bold transition-all border ${
                      filter === f
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-lg"
                        : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1).replace("-", " ")}
                  </button>
                ))}
              </div>
            </div>

            {dateError && (
              <div className="p-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-bold">
                {dateError}
              </div>
            )}

            <div className="flex flex-wrap gap-2 items-center">
              <span className="text-sm font-bold text-gray-700">Status:</span>
              {["all", "pending", "in-progress", "resolved"].map((s) => {
                const active = statusFilter === s;
                const style =
                  s === "pending"      ? "bg-yellow-600 text-white"
                  : s === "in-progress" ? "bg-blue-600 text-white"
                  : s === "resolved"    ? "bg-green-600 text-white"
                  : "bg-gray-900 text-white";
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-4 py-2.5 rounded-xl transition-all text-sm font-bold border ${
                      active ? `${style} border-transparent shadow-lg` : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    {s === "all" ? "All Status" : s.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ")}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white/85 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/60 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3" />
              <span className="text-gray-500 font-semibold">Loading complaints...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1080px] text-left">
                <thead>
                  <tr className="bg-linear-to-r from-slate-50 via-white to-slate-50 border-b border-gray-200">
                    {["Urgency", "Purok", "Complainant", "Issue Type", "Description", "Deployed Tanod", "Date", "Status"].map((h) => (
                      <th key={h} className="px-5 py-4 text-xs font-extrabold tracking-wider text-gray-600 uppercase">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredNotifications.map((n, idx) => {
                    const urgency = getUrgencyDisplay(n.label);
                    const status  = getStatusDisplay(n.status);
                    return (
                      <tr
                        key={n.complaintKey}
                        className={`${idx % 2 === 0 ? "bg-white" : "bg-slate-50/70"} border-b border-gray-100 hover:bg-indigo-50/60 transition cursor-pointer`}
                        onClick={() => setSelectedComplaint(n)}
                      >
                        <td className="px-5 py-4">
                          <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${urgency.pill}`}>
                            {urgency.icon}{urgency.text}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-gray-900">Purok {n.incidentPurok}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2 text-sm font-bold text-gray-900">
                            {n.name}
                            {n.status === "resolved" && n.hasFeedback && !seenKeys.has(n.complaintKey) && (
                              <span className="relative flex items-center justify-center">
                                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600" />
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${getIssueColor(n.type)}`}>{n.type}</span>
                        </td>
                        <td className="px-5 py-4 max-w-[280px]">
                          <p className="text-sm font-semibold text-gray-700 line-clamp-1">{n.message}</p>
                        </td>
                        <td className="px-5 py-4">
                          {n.deployedTanods && n.deployedTanods.length > 0
                            ? <div className="flex flex-col gap-1">
                                {n.deployedTanods.map((t) => (
                                  <div key={t.uid} className="flex items-center gap-1.5">
                                    <FiShield className="text-indigo-500 shrink-0" size={14} />
                                    <span className="text-xs font-bold text-indigo-700">{t.name}</span>
                                  </div>
                                ))}
                              </div>
                            : n.deployedTanodName
                            ? <div className="flex items-center gap-1.5"><FiShield className="text-indigo-500 shrink-0" size={14} /><span className="text-xs font-bold text-indigo-700">{n.deployedTanodName}</span></div>
                            : <span className="text-xs text-gray-400 font-semibold italic">Unassigned</span>}
                        </td>
                        <td className="px-5 py-4 text-sm font-semibold text-gray-800">{n.timestamp}</td>
                        <td className="px-5 py-4">
                          <span className={`inline-flex px-3 py-1.5 rounded-full text-xs font-bold ${status.pill}`}>{status.text}</span>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredNotifications.length === 0 && (
                    <tr>
                      <td colSpan={8} className="text-center py-10 text-gray-500 text-sm font-bold">No complaints found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Detail Modal ─────────────────────────────────────────────────── */}
        {selectedComplaint && (
          <div
            className="fixed inset-0 z-50 p-4 bg-black/40 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setSelectedComplaint(null)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[96vh] shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative bg-linear-to-r from-indigo-600 via-purple-600 to-pink-600 p-6 text-white">
                <button
                  className="absolute top-4 right-4 text-white/90 hover:bg-white/15 rounded-full p-2 transition"
                  onClick={() => setSelectedComplaint(null)}
                >
                  <FiX size={22} />
                </button>
                <h2 className="text-2xl font-extrabold">Complaint Details</h2>
                <p className="text-white/85 text-sm font-semibold mt-1">Case ID: {selectedComplaint.complaintKey}</p>
              </div>

              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                <div className="flex flex-col md:flex-row gap-3 flex-wrap">
                  <div className={`rounded-xl px-4 py-3 ${getStatusDisplay(selectedComplaint.status).pill}`}>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      <FiCheckCircle size={18} />Status: {getStatusDisplay(selectedComplaint.status).text}
                    </div>
                  </div>
                  <div className={`rounded-xl px-4 py-3 ${getUrgencyDisplay(selectedComplaint.label).pill}`}>
                    <div className="flex items-center gap-2 text-sm font-bold">
                      {getUrgencyDisplay(selectedComplaint.label).icon}
                      {getUrgencyDisplay(selectedComplaint.label).text}
                    </div>
                  </div>
                  {selectedComplaint.deployedTanods && selectedComplaint.deployedTanods.length > 0 ? (
                    selectedComplaint.deployedTanods.map((t) => (
                      <div key={t.uid} className="rounded-xl px-4 py-3 bg-indigo-50 ring-1 ring-indigo-200">
                        <div className="flex items-center gap-2 text-sm font-bold text-indigo-800">
                          <FiShield size={18} />Deployed: {t.name}
                        </div>
                      </div>
                    ))
                  ) : selectedComplaint.deployedTanodName && (
                    <div className="rounded-xl px-4 py-3 bg-indigo-50 ring-1 ring-indigo-200">
                      <div className="flex items-center gap-2 text-sm font-bold text-indigo-800">
                        <FiShield size={18} />Deployed: {selectedComplaint.deployedTanodName}
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoRow icon={<FiUser size={18} />}     title="Complainant"       value={selectedComplaint.name}                     tone="indigo" />
                  <InfoRow icon={<FiMapPin size={18} />}   title="Purok"             value={`Purok ${selectedComplaint.incidentPurok}`} tone="green"  />
                  <InfoRow icon={<FiHome size={18} />}     title="Incident Location" value={selectedComplaint.incidentLocation}          tone="amber"  />
                  <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-purple-100 text-purple-700"><FiFileText size={18} /></div>
                      <div className="flex-1">
                        <p className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">Issue Type</p>
                        <span className={`inline-flex mt-2 px-3 py-1.5 rounded-full text-sm font-bold ${getIssueColor(selectedComplaint.type)}`}>
                          {selectedComplaint.type}
                        </span>
                      </div>
                    </div>
                  </div>
                  <InfoRow icon={<FiCalendar size={18} />} title="Date Reported" value={selectedComplaint.timestamp} tone="orange" />
                  {selectedComplaint.evidencePhoto && (
                    <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
                      <p className="text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-2">Proof</p>
                      <img
                        src={selectedComplaint.evidencePhoto}
                        alt="Proof"
                        onClick={() => setPreviewImage(selectedComplaint.evidencePhoto)}
                        className="w-full h-auto object-cover rounded-xl shadow-lg border cursor-pointer hover:opacity-90 transition"
                      />
                      <p className="mt-2 text-xs font-semibold text-gray-600">Click image to preview.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                  <p className="text-xs font-extrabold text-gray-600 uppercase tracking-wider mb-2">Complaint Description</p>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed whitespace-pre-line">{selectedComplaint.message}</p>
                </div>

                {/* View Feedback button — only for resolved complaints */}
                {selectedComplaint.status === "resolved" && (
                  <button
                    className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition shadow-md"
                    onClick={() => handleViewFeedback(selectedComplaint)}
                  >
                    <FiStar size={16} /> View Citizen Feedback
                  </button>
                )}
              </div>

              <div className="border-t p-5 bg-white">
                <button
                  disabled={selectedComplaint.status === "resolved"}
                  className={`w-full py-3.5 rounded-xl text-white text-base font-extrabold transition shadow-lg ${actionBg(selectedComplaint.status)}`}
                  onClick={() => handleActionClick(selectedComplaint)}
                >
                  {actionLabel(selectedComplaint.status)}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Deploy Tanod Modal ──────────────────────────────────────────── */}
        {showDeployModal && (
          <div
            className="fixed inset-0 z-60 p-4 bg-black/50 backdrop-blur-sm flex items-center justify-center"
            onClick={() => setShowDeployModal(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-linear-to-r from-indigo-600 to-purple-600 px-6 py-5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3 text-white">
                  <div className="bg-white/20 p-2.5 rounded-xl"><FiShield size={20} /></div>
                  <div>
                    <h3 className="text-lg font-extrabold">Deploy Tanods</h3>
                    <p className="text-indigo-100 text-xs font-semibold mt-0.5">Select at least {MIN_TANODS} available tanods to deploy</p>
                  </div>
                </div>
                <button
                  className="text-white/80 hover:text-white hover:bg-white/15 rounded-full p-2 transition"
                  onClick={() => setShowDeployModal(false)}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-3">
                  <p className="text-xs font-extrabold text-indigo-700 uppercase tracking-wider">Complaint</p>
                  <p className="text-sm font-bold text-gray-800 mt-1 line-clamp-2">{deployTarget?.message || "—"}</p>
                  <p className="text-xs text-gray-500 font-semibold mt-0.5">
                    by {deployTarget?.name} · Purok {deployTarget?.incidentPurok}
                  </p>
                </div>

                {/* Search tanods */}
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 text-gray-400 -translate-y-1/2" size={16} />
                  <input
                    type="text"
                    placeholder="Search tanod by name or role..."
                    className="w-full pl-9 pr-4 py-2.5 text-sm font-semibold border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-4 focus:ring-indigo-200"
                    value={tanodSearch}
                    onChange={(e) => { setTanodSearch(e.target.value); setTanodPage(1); }}
                  />
                </div>

                {/* Tanod table */}
                {filteredTanods.length === 0 ? (
                  <p className="text-sm text-gray-500 font-semibold text-center py-6">No tanods found.</p>
                ) : (
                  <>
                    <div className="overflow-x-auto rounded-xl border border-gray-200">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="bg-slate-50 border-b border-gray-200">
                            <th className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase tracking-wider w-8"></th>
                            <th className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase tracking-wider">Name</th>
                            <th className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase tracking-wider">Role</th>
                            <th className="px-4 py-3 text-xs font-extrabold text-gray-600 uppercase tracking-wider">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTanods.map((t) => {
                            const isDeployed = t.deploymentStatus === "deployed";
                            const isSelected = selectedTanods.has(t.uid);
                            return (
                              <tr
                                key={t.uid}
                                onClick={() => { if (!isDeployed) toggleTanod(t.uid); }}
                                className={`border-b border-gray-100 transition ${
                                  isDeployed
                                    ? "opacity-50 cursor-not-allowed bg-gray-50"
                                    : isSelected
                                    ? "bg-indigo-50 ring-1 ring-indigo-300 cursor-pointer"
                                    : "hover:bg-gray-50 cursor-pointer"
                                }`}
                              >
                                <td className="px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    disabled={isDeployed}
                                    onChange={() => toggleTanod(t.uid)}
                                    className="accent-indigo-600 w-4 h-4"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                      <FiUser size={14} />
                                    </div>
                                    <span className="text-sm font-extrabold text-gray-900 truncate">{t.fullName}</span>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs font-semibold text-gray-500 capitalize">
                                  Tanod
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-bold ${
                                    isDeployed
                                      ? "bg-red-100 text-red-700 ring-1 ring-red-200"
                                      : "bg-green-100 text-green-700 ring-1 ring-green-200"
                                  }`}>
                                    {isDeployed ? "Deployed" : "Available"}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {tanodTotalPages > 1 && (
                      <div className="flex items-center justify-between pt-1">
                        <p className="text-xs font-semibold text-gray-500">
                          Page {tanodPage} of {tanodTotalPages} · {filteredTanods.length} tanod{filteredTanods.length !== 1 ? "s" : ""}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => setTanodPage((p) => Math.max(1, p - 1))}
                            disabled={tanodPage <= 1}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            <FiChevronLeft size={16} />
                          </button>
                          <button
                            onClick={() => setTanodPage((p) => Math.min(tanodTotalPages, p + 1))}
                            disabled={tanodPage >= tanodTotalPages}
                            className="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
                          >
                            <FiChevronRight size={16} />
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="border-t px-6 py-4 bg-slate-50 space-y-3 shrink-0">
                {selectedTanods.size > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-600">Selected ({selectedTanods.size}):</span>
                    {[...selectedTanods].map((uid) => {
                      const t = tanods.find((x) => x.uid === uid);
                      return (
                        <span key={uid} className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold ring-1 ring-indigo-200">
                          <FiShield size={12} />{t?.fullName || uid}
                          <button onClick={() => toggleTanod(uid)} className="ml-0.5 hover:text-red-600 transition"><FiX size={12} /></button>
                        </span>
                      );
                    })}
                  </div>
                )}
                {selectedTanods.size > 0 && selectedTanods.size < MIN_TANODS && (
                  <p className="text-xs font-bold text-amber-600">Select at least {MIN_TANODS} tanods to deploy.</p>
                )}
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowDeployModal(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-700 font-bold text-sm hover:bg-gray-100 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeploy}
                    disabled={selectedTanods.size < MIN_TANODS || deploying}
                    className={`flex-1 py-3 rounded-xl text-white font-extrabold text-sm transition shadow-md ${
                      selectedTanods.size < MIN_TANODS || deploying ? "bg-gray-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                    }`}
                  >
                    {deploying ? "Deploying…" : `Deploy ${selectedTanods.size} Tanod${selectedTanods.size !== 1 ? "s" : ""} →`}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Confirm Resolve Modal ────────────────────────────────────────── */}
        {showConfirmResolve && (
          <ConfirmResolveModal
            complaint={resolvingComplaint}
            onConfirm={confirmResolve}
            onCancel={() => { setShowConfirmResolve(false); setResolvingComplaint(null); }}
            resolving={resolving}
          />
        )}

        {/* ── View Citizen Feedback Modal (read-only) ──────────────────────── */}
        {showViewFeedbackModal && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-70 backdrop-blur-sm p-4"
            onClick={() => setShowViewFeedbackModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="px-6 py-5 flex items-center justify-between bg-linear-to-r from-indigo-600 to-purple-600 shrink-0">
                <div className="flex items-center gap-3 text-white">
                  <div className="bg-white/20 p-2.5 rounded-xl"><FiStar size={20} /></div>
                  <div>
                    <h3 className="text-lg font-extrabold">Citizen Feedback</h3>
                    <p className="text-indigo-100 text-xs font-semibold mt-0.5">Submitted by the complainant</p>
                  </div>
                </div>
                <button
                  className="text-white/80 hover:text-white hover:bg-white/15 rounded-full p-2 transition"
                  onClick={() => setShowViewFeedbackModal(false)}
                >
                  <FiX size={20} />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {feedbackLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mr-3" />
                    <span className="text-gray-500 font-semibold">Loading feedback…</span>
                  </div>
                ) : viewFeedbackData ? (
                  <>
                    {/* Complaint info */}
                    {viewFeedbackData.complainantName && (
                      <div className="rounded-xl border border-gray-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider">Complaint</p>
                        <p className="text-sm font-bold text-gray-800 mt-0.5">
                          by {viewFeedbackData.complainantName}
                        </p>
                        {viewFeedbackData.type && (
                          <p className="text-xs text-gray-500 font-semibold">{viewFeedbackData.type} · Purok {viewFeedbackData.incidentPurok}</p>
                        )}
                      </div>
                    )}

                    {/* Tanod Rating */}
                    <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0"><FiShield size={17} /></div>
                        <p className="text-sm font-extrabold text-gray-900">Tanod Rating</p>
                      </div>

                      {viewFeedbackData.tanodRating ? (
                        <>
                          <div className="flex items-center gap-3">
                            <StarDisplay value={viewFeedbackData.tanodRating} />
                            <span className="text-sm font-extrabold text-gray-800">
                              {viewFeedbackData.tanodRating}/5
                              <span className="ml-1.5 text-indigo-600 font-bold">
                                — {ratingLabel(viewFeedbackData.tanodRating)}
                              </span>
                            </span>
                          </div>
                          {viewFeedbackData.tanodComment ? (
                            <div className="bg-white rounded-xl border border-indigo-100 p-3">
                              <p className="text-xs font-extrabold text-gray-500 uppercase tracking-wider mb-1">Comment</p>
                              <p className="text-sm text-gray-700 leading-relaxed">{viewFeedbackData.tanodComment}</p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400 font-semibold italic">No comment provided.</p>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2 py-2">
                          <StarDisplay value={0} />
                          <span className="text-sm text-gray-400 font-semibold italic">No rating submitted yet.</span>
                        </div>
                      )}
                    </div>

                    {/* Resolved timestamp */}
                    {viewFeedbackData.resolvedAt && (
                      <p className="text-xs text-gray-400 font-semibold text-center">
                        Resolved on {viewFeedbackData.resolvedAt}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="bg-indigo-600 text-white p-2.5 rounded-xl shrink-0"><FiShield size={17} /></div>
                      <p className="text-sm font-extrabold text-gray-900">Tanod Rating</p>
                    </div>
                    <div className="flex items-center gap-3 py-1">
                      <StarDisplay value={0} />
                      <span className="text-sm text-gray-400 font-semibold italic">No rating submitted yet.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Image Preview ─────────────────────────────────────────────────── */}
        {previewImage && (
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-md flex items-center justify-center z-80 p-4"
            onClick={() => setPreviewImage(null)}
          >
            <img
              src={previewImage}
              alt="Preview"
              className="max-w-[92%] max-h-[92%] rounded-2xl shadow-2xl border border-white/20"
            />
            <button
              className="absolute top-6 right-6 text-white text-4xl font-extrabold"
              onClick={() => setPreviewImage(null)}
            >
              ✖
            </button>
          </div>
        )}

      </div>
    </div>
  );
};

export default Notiftable;

/* ── Helpers ─────────────────────────────────────────────────────────────── */
const StatCard = ({ label, value, tone }) => {
  const t = {
    indigo: { ring: "ring-indigo-200", bg: "from-indigo-50 to-white", dot: "bg-indigo-600", text: "text-indigo-700" },
    yellow: { ring: "ring-yellow-200", bg: "from-yellow-50 to-white", dot: "bg-yellow-600", text: "text-yellow-700" },
    blue:   { ring: "ring-blue-200",   bg: "from-blue-50 to-white",   dot: "bg-blue-600",   text: "text-blue-700"   },
    green:  { ring: "ring-green-200",  bg: "from-green-50 to-white",  dot: "bg-green-600",  text: "text-green-700"  },
  }[tone] || {};
  return (
    <div className="rounded-2xl bg-white shadow-xl border border-gray-200 overflow-hidden">
      <div className={`p-5 bg-linear-to-b ${t.bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className={`text-xs font-extrabold uppercase tracking-wider ${t.text}`}>{label}</p>
            <p className="mt-2 text-3xl font-extrabold text-gray-900">{value}</p>
          </div>
          <div className={`shrink-0 w-3.5 h-3.5 rounded-full ${t.dot} ring-8 ${t.ring}`} />
        </div>
      </div>
    </div>
  );
};

const InfoRow = ({ icon, title, value, tone }) => {
  const chip = {
    indigo: "bg-indigo-100 text-indigo-700",
    green:  "bg-green-100 text-green-700",
    amber:  "bg-amber-100 text-amber-700",
    orange: "bg-orange-100 text-orange-700",
  }[tone] || "bg-indigo-100 text-indigo-700";
  return (
    <div className="rounded-xl border border-gray-200 p-4 bg-white shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`p-2.5 rounded-xl ${chip}`}>{icon}</div>
        <div className="flex-1">
          <p className="text-xs font-extrabold text-gray-600 uppercase tracking-wider">{title}</p>
          <p className="mt-1.5 text-sm font-extrabold text-gray-900">{value || "—"}</p>
        </div>
      </div>
    </div>
  );
};