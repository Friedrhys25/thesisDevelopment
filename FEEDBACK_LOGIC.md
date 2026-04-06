# Feedback Logic — Talk2Kap

This document explains how the **mobile app** should write feedback for a resolved complaint so the **admin dashboard** can display it.

---

## Database Structure

Feedback is stored **inside the deployed tanod's deployment history**, not in a separate `complaintFeedback` collection.

```
employee/{tanodUid}/deploymentHistory/{complaintKey}
```

When a complaint is resolved by the admin, a document is created at the path above with the following fields (among others):

| Field          | Type      | Initial Value |
|----------------|-----------|---------------|
| `tanodRating`  | number    | `null`        |
| `tanodComment` | string    | `null`        |
| `status`       | string    | `"resolved"`  |
| `complainantName` | string | *(set on creation)* |
| `type`         | string    | complaint type |
| `incidentPurok`| string    | purok location |
| `description`  | string    | complaint body |
| `deployedAt`   | timestamp | when tanod was deployed |
| `resolvedAt`   | timestamp | when complaint was resolved |

---

## How to Submit Feedback (Mobile App)

When a citizen wants to rate the tanod who resolved their complaint, the mobile app should perform **two writes**:

### Step 1 — Update the deployment history document

Read the complaint document to get `deployedTanodUid` and use the complaint's document ID as `complaintKey`.

```js
import { doc, updateDoc } from "firebase/firestore";

const deployedTanodUid = complaint.deployedTanodUid; // from the complaint doc
const complaintKey     = complaint.id;                // the complaint document ID

await updateDoc(
  doc(firestore, "employee", deployedTanodUid, "deploymentHistory", complaintKey),
  {
    tanodRating:  selectedRating,   // number 1–5
    tanodComment: commentText || null,
  }
);
```

### Step 2 — Flag the complaint as having feedback

This lets the admin dashboard show a notification dot.

```js
await updateDoc(
  doc(firestore, "users", userId, "userComplaints", complaintKey),
  {
    hasFeedback: true,
  }
);
```

`userId` is the authenticated citizen's UID (the owner of the complaint).

---

## Summary of Writes

| # | Collection Path | Fields Written |
|---|-----------------|----------------|
| 1 | `employee/{deployedTanodUid}/deploymentHistory/{complaintKey}` | `tanodRating` (1–5), `tanodComment` (string or null) |
| 2 | `users/{userId}/userComplaints/{complaintKey}` | `hasFeedback: true` |

---

## How the Admin Dashboard Reads Feedback

1. The complaint listener detects `hasFeedback === true` and shows a notification dot.
2. When the admin clicks the feedback icon, it fetches `employee/{deployedTanodUid}/deploymentHistory/{complaintKey}` via `getDoc`.
3. The modal displays `tanodRating` as 1–5 stars and `tanodComment` below it.

---

## Firestore Security Rules

Make sure these rules are in place:

```
match /employee/{uid}/deploymentHistory/{docId} {
  allow read, write: if request.auth != null;
}
```

You may want to tighten the write rule so only the complainant can write feedback:

```
match /employee/{uid}/deploymentHistory/{docId} {
  allow read: if request.auth != null;
  allow update: if request.auth != null
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['tanodRating', 'tanodComment']);
}
```

This restricts updates to only the `tanodRating` and `tanodComment` fields.
