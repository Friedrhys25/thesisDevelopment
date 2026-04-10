# Feedback Viewing — Admin Dashboard (Per Tanod)

This document explains how the **admin dashboard** should fetch and display feedback ratings for each individual tanod.

---

## Firestore Data Source

All feedback is stored inside each tanod's deployment history:

```
employee/{tanodUid}/deploymentHistory/{complaintKey}
```

### Fields to Read

| Field             | Type          | Description                              |
|-------------------|---------------|------------------------------------------|
| `tanodRating`     | number (1–5)  | Star rating given by the complainant      |
| `tanodComment`    | string / null | Optional remark from the complainant      |
| `complainantName` | string        | Name of the person who filed complaint    |
| `type`            | string        | Complaint type (e.g. "noise", "theft")    |
| `incidentPurok`   | string        | Purok where the incident happened         |
| `description`     | string        | Original complaint message                |
| `deployedAt`      | string        | ISO timestamp when tanod was deployed     |
| `resolvedAt`      | string        | ISO timestamp when complaint was resolved |
| `status`          | string        | Should be `"resolved"`                    |
| `coDeployedTanods`| array         | Other tanods deployed alongside           |

---

## How to Fetch All Ratings for a Specific Tanod

```js
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { firestore } from "./firebaseConfig";

const fetchTanodRatings = async (tanodUid) => {
  const historyRef = collection(firestore, "employee", tanodUid, "deploymentHistory");
  const q = query(historyRef, orderBy("resolvedAt", "desc"));
  const snapshot = await getDocs(q);

  const ratings = [];
  snapshot.forEach((doc) => {
    const data = doc.data();
    // Only include entries that have been rated
    if (data.tanodRating !== null && data.tanodRating !== undefined) {
      ratings.push({
        complaintKey: doc.id,
        rating: data.tanodRating,           // 1–5
        comment: data.tanodComment || null,  // remark or null
        complainantName: data.complainantName,
        type: data.type,
        incidentPurok: data.incidentPurok,
        resolvedAt: data.resolvedAt,
      });
    }
  });

  return ratings;
};
```

---

## How to Compute Average Rating for a Tanod

```js
const computeAverageRating = (ratings) => {
  if (ratings.length === 0) return 0;
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return (sum / ratings.length).toFixed(1); // e.g. "4.3"
};
```

---

## How to Detect New Feedback (Notification Dot)

The mobile app sets `hasFeedback: true` on the complaint document:

```
users/{userId}/userComplaints/{complaintKey}
```

### Listener for Admin

```js
import { collection, onSnapshot, query, where } from "firebase/firestore";

// Listen to ALL users' complaints that have new feedback
// Option 1: Listen per-user (if you already have the user list)
const listenForFeedback = (userId) => {
  const complaintsRef = collection(firestore, "users", userId, "userComplaints");
  const q = query(complaintsRef, where("hasFeedback", "==", true));

  return onSnapshot(q, (snapshot) => {
    snapshot.forEach((doc) => {
      const data = doc.data();
      // This complaint has new feedback — show notification
      console.log("New feedback on:", doc.id, data);
    });
  });
};
```

---

## How to Read Individual Feedback (When Admin Clicks Notification)

When the admin clicks a feedback notification for a specific complaint:

```js
import { doc, getDoc } from "firebase/firestore";

const fetchFeedbackForComplaint = async (complaint) => {
  // complaint.deployedTanods = [{ uid, name }, ...]
  const tanods = complaint.deployedTanods || [];

  // Fallback for old single-tanod complaints
  if (tanods.length === 0 && complaint.deployedTanodUid) {
    tanods.push({ uid: complaint.deployedTanodUid, name: complaint.deployedTanodName || "Tanod" });
  }

  const feedbackList = [];

  for (const tanod of tanods) {
    const historyDoc = await getDoc(
      doc(firestore, "employee", tanod.uid, "deploymentHistory", complaint.complaintKey)
    );

    if (historyDoc.exists()) {
      const data = historyDoc.data();
      feedbackList.push({
        tanodUid: tanod.uid,
        tanodName: tanod.name,
        rating: data.tanodRating,        // 1–5 or null
        comment: data.tanodComment,      // string or null
      });
    }
  }

  return feedbackList;
};
```

---

## Display Example

### Per-Tanod Feedback Card

```
┌──────────────────────────────────────┐
│  👮 Juan Dela Cruz                   │
│  ⭐⭐⭐⭐⭐  (5/5)                    │
│  "Very responsive and professional"  │
├──────────────────────────────────────┤
│  👮 Pedro Reyes                      │
│  ⭐⭐⭐☆☆  (3/5)                      │
│  "Arrived late but handled it well"  │
└──────────────────────────────────────┘
```

### Tanod Profile Summary

```
┌─────────────────────────────────────────┐
│  Juan Dela Cruz                         │
│  Average Rating: ⭐ 4.3 / 5            │
│  Total Deployments: 15                  │
│  Rated Deployments: 12                  │
│                                         │
│  Recent Feedback:                       │
│  • Noise complaint (Purok 3) — ⭐⭐⭐⭐⭐ │
│    "Very responsive"                    │
│  • Theft report (Purok 1) — ⭐⭐⭐⭐☆     │
│    "Good but could be faster"           │
└─────────────────────────────────────────┘
```

---

## Summary of Paths

| Action                        | Path                                                          |
|-------------------------------|---------------------------------------------------------------|
| Get all ratings for a tanod   | `employee/{tanodUid}/deploymentHistory` (query all docs)       |
| Get feedback for 1 complaint  | `employee/{tanodUid}/deploymentHistory/{complaintKey}` (getDoc) |
| Check if feedback exists      | `users/{userId}/userComplaints/{complaintKey}` → `hasFeedback` |
| Get tanod list for complaint  | `users/{userId}/userComplaints/{complaintKey}` → `deployedTanods` |
