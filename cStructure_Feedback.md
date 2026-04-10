# Feedback & Tanod Rating — Firestore Structure

## Overview

Feedback (star ratings + comments) for tanods is stored **inside each deployed tanod's deployment history**, not in the complaint document itself. The complaint only holds a boolean flag (`hasFeedback`) to indicate whether feedback has been submitted.

---

## Firestore Collections Involved

| Collection Path | Purpose |
|---|---|
| `employee/{tanodUid}/deploymentHistory/{complaintKey}` | Stores the actual `tanodRating` and `tanodComment` |
| `users/{userId}/userComplaints/{complaintKey}` | Stores the `hasFeedback` flag + `deployedTanods` array |

---

## Document Structure

### `employee/{tanodUid}/deploymentHistory/{complaintKey}`

This is where the **actual rating data** lives.

```json
{
  "complaintKey": "complaint_abc123",
  "userId": "user_xyz789",
  "complainantName": "Maria Santos",
  "type": "noise",
  "incidentPurok": "3",
  "description": "Loud karaoke at 2AM...",
  "deployedAt": "2026-04-05T10:30:00.000Z",
  "resolvedAt": "2026-04-05T14:00:00.000Z",
  "status": "resolved",
  "tanodRating": 5,
  "tanodComment": "Very responsive and professional",
  "coDeployedTanods": [
    { "uid": "tanod_uid_2", "name": "Pedro Reyes" }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `tanodRating` | `number (1–5)` or `null` | Star rating from the complainant. `null` = not yet rated |
| `tanodComment` | `string` or `null` | Optional written feedback. `null` = no comment |
| `complainantName` | `string` | Name of the citizen who filed the complaint |
| `type` | `string` | Complaint category (e.g. "noise", "theft") |
| `incidentPurok` | `string` | Purok where the incident occurred |
| `description` | `string` | Original complaint message |
| `deployedAt` | `string` (ISO) | When the tanod was deployed to this complaint |
| `resolvedAt` | `string` (ISO) | When the complaint was marked resolved |
| `status` | `string` | Always `"resolved"` for history entries |
| `coDeployedTanods` | `array` | Other tanods deployed alongside this one |

### `users/{userId}/userComplaints/{complaintKey}`

This only holds the **flag** and **tanod list** — not the ratings themselves.

```json
{
  "hasFeedback": true,
  "deployedTanods": [
    { "uid": "tanod_uid_1", "name": "Juan Dela Cruz" },
    { "uid": "tanod_uid_2", "name": "Pedro Reyes" }
  ],
  "deployedTanodUid": "tanod_uid_1",
  "status": "resolved"
}
```

| Field | Type | Description |
|---|---|---|
| `hasFeedback` | `boolean` | `true` after citizen submits ratings, `false` otherwise |
| `deployedTanods` | `array` | All tanods deployed to this complaint `[{ uid, name }]` |
| `deployedTanodUid` | `string` | Legacy field — UID of the first/primary tanod |

---

## How to READ Feedback Data

### Get Rating for a Single Tanod on a Single Complaint

Use this when you know the tanod UID and complaint key.

```javascript
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebaseConfig";

const getTanodFeedback = async (tanodUid, complaintKey) => {
  const ref = doc(firestore, "employee", tanodUid, "deploymentHistory", complaintKey);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    console.log("No deployment history found");
    return null;
  }

  const data = snap.data();
  return {
    tanodRating: data.tanodRating,     // number 1–5 or null
    tanodComment: data.tanodComment,   // string or null
    complainantName: data.complainantName,
    type: data.type,
    resolvedAt: data.resolvedAt,
  };
};

// Usage:
const feedback = await getTanodFeedback("tanod_uid_1", "complaint_abc123");
// feedback.tanodRating  → 5
// feedback.tanodComment → "Very responsive"
```

### Get ALL Ratings for a Specific Tanod

Use this for a tanod profile page or performance report.

```javascript
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { firestore } from "./firebaseConfig";

const fetchAllRatingsForTanod = async (tanodUid) => {
  const historyRef = collection(firestore, "employee", tanodUid, "deploymentHistory");
  const q = query(historyRef, orderBy("resolvedAt", "desc"));
  const snapshot = await getDocs(q);

  const ratings = [];
  snapshot.forEach((docSnap) => {
    const data = docSnap.data();
    // Only include entries that have been rated
    if (data.tanodRating !== null && data.tanodRating !== undefined) {
      ratings.push({
        complaintKey: docSnap.id,
        rating: data.tanodRating,
        comment: data.tanodComment || null,
        complainantName: data.complainantName,
        type: data.type,
        incidentPurok: data.incidentPurok,
        resolvedAt: data.resolvedAt,
      });
    }
  });

  return ratings;
};

// Usage:
const allRatings = await fetchAllRatingsForTanod("tanod_uid_1");
// allRatings → [{ complaintKey, rating: 5, comment: "Great", ... }, ...]
```

### Compute Average Rating for a Tanod

```javascript
const computeAverage = (ratings) => {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return parseFloat((sum / ratings.length).toFixed(1));
};

// Usage:
const avg = computeAverage(allRatings); // → 4.3
```

### Get Feedback for ALL Tanods on a Single Complaint

Use this when viewing a resolved complaint and wanting to see ratings for every tanod that was deployed.

```javascript
import { doc, getDoc } from "firebase/firestore";
import { firestore } from "./firebaseConfig";

const getFeedbackForComplaint = async (userId, complaintKey) => {
  // Step 1: Get the tanod list from the complaint document
  const complaintRef = doc(firestore, "users", userId, "userComplaints", complaintKey);
  const complaintSnap = await getDoc(complaintRef);

  if (!complaintSnap.exists()) {
    console.log("Complaint not found");
    return [];
  }

  const complaintData = complaintSnap.data();
  const tanods = complaintData.deployedTanods || [];

  // Fallback for legacy single-tanod field
  if (tanods.length === 0 && complaintData.deployedTanodUid) {
    tanods.push({
      uid: complaintData.deployedTanodUid,
      name: complaintData.deployedTanodName || "Tanod",
    });
  }

  // Step 2: Fetch each tanod's rating from their deploymentHistory
  const results = [];
  for (const tanod of tanods) {
    const historyRef = doc(
      firestore, "employee", tanod.uid, "deploymentHistory", complaintKey
    );
    const historySnap = await getDoc(historyRef);

    if (historySnap.exists()) {
      const data = historySnap.data();
      results.push({
        tanodUid: tanod.uid,
        tanodName: tanod.name,
        rating: data.tanodRating,       // 1–5 or null
        comment: data.tanodComment,     // string or null
      });
    } else {
      results.push({
        tanodUid: tanod.uid,
        tanodName: tanod.name,
        rating: null,
        comment: null,
      });
    }
  }

  return results;
};

// Usage:
const feedbackList = await getFeedbackForComplaint("user_xyz789", "complaint_abc123");
// feedbackList → [
//   { tanodUid: "uid_1", tanodName: "Juan", rating: 5, comment: "Great" },
//   { tanodUid: "uid_2", tanodName: "Pedro", rating: 4, comment: null }
// ]
```

---

## How Feedback is WRITTEN (Mobile App)

When a citizen submits feedback, the app performs two writes:

### Write 1: Update each tanod's deployment history

```javascript
import { doc, updateDoc } from "firebase/firestore";

// For each deployed tanod:
await updateDoc(
  doc(firestore, "employee", tanodUid, "deploymentHistory", complaintKey),
  {
    tanodRating: selectedRating,      // number 1–5
    tanodComment: commentText || null, // string or null
  }
);
```

### Write 2: Flag the complaint as having feedback

```javascript
await updateDoc(
  doc(firestore, "users", userId, "userComplaints", complaintKey),
  {
    hasFeedback: true,
  }
);
```

---

## When Feedback Can Be Submitted

All three conditions must be true:

| Condition | Check |
|---|---|
| Complaint status is `"resolved"` | `complaint.status === "resolved"` |
| Tanods are deployed | `complaint.deployedTanods.length > 0` OR `complaint.deployedTanodUid` exists |
| Feedback not already submitted | `complaint.hasFeedback !== true` |

If `hasFeedback` is already `true`, the app switches to **view-only** mode and fetches existing ratings from `deploymentHistory`.

---

## Quick Reference: Where to Look in Firestore Console

| What you want | Path in Firestore |
|---|---|
| See if feedback was submitted | `users/{userId}/userComplaints/{complaintKey}` → `hasFeedback` field |
| See the actual star rating | `employee/{tanodUid}/deploymentHistory/{complaintKey}` → `tanodRating` |
| See the feedback comment | `employee/{tanodUid}/deploymentHistory/{complaintKey}` → `tanodComment` |
| See all ratings for a tanod | `employee/{tanodUid}/deploymentHistory/` → browse all docs |
| See which tanods were deployed | `users/{userId}/userComplaints/{complaintKey}` → `deployedTanods` array |
