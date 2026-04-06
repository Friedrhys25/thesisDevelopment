# Tanod-Side Complaint Fetching Logic

## Overview

Each tanod (employee) logged in to the React Native app needs to:
1. See the complaint currently deployed to them
2. See the full complaint details
3. See who the other tanod(s) deployed with them are

---

## Firestore Structure

### `employee/{tanodUid}` (Tanod's own document)

```
{
  firstName: "Juan",
  lastName: "Dela Cruz",
  deploymentStatus: "available" | "deployed",
  deployedTo: {                              // null when available
    complaintKey: "complaint_abc123",
    userId: "user_xyz789",                   // complainant's UID
    complainantName: "Maria Santos",
    type: "noise",
    incidentPurok: "3",
    description: "Loud karaoke at 2AM...",
    deployedAt: "2026-04-05T10:30:00.000Z",
    coDeployedTanods: [                      // other tanods deployed alongside
      { uid: "tanod_uid_2", name: "Pedro Reyes" },
      { uid: "tanod_uid_3", name: "Ana Cruz" }
    ]
  }
}
```

### `users/{userId}/userComplaints/{complaintKey}` (Complaint document)

```
{
  message: "Loud karaoke at 2AM...",
  type: "noise",
  label: "urgent" | "non-urgent",
  status: "pending" | "in-progress" | "resolved",
  incidentPurok: "3",
  incidentLocation: "Near basketball court",
  evidencePhoto: "https://...",
  timestamp: Timestamp,
  deployedTanods: [                          // array of all deployed tanods
    { uid: "tanod_uid_1", name: "Juan Dela Cruz" },
    { uid: "tanod_uid_2", name: "Pedro Reyes" }
  ],
  deployedTanodUid: "tanod_uid_1",          // legacy/first tanod (backward compat)
  deployedTanodName: "Juan Dela Cruz, Pedro Reyes",
  hasFeedback: false,
  resolvedAt: Timestamp | null
}
```

### `employee/{tanodUid}/deploymentHistory/{complaintKey}` (After resolved)

```
{
  complaintKey: "complaint_abc123",
  userId: "user_xyz789",
  complainantName: "Maria Santos",
  type: "noise",
  incidentPurok: "3",
  description: "Loud karaoke at 2AM...",
  deployedAt: "2026-04-05T10:30:00.000Z",
  resolvedAt: "2026-04-05T14:00:00.000Z",
  status: "resolved",
  tanodRating: 5 | null,
  tanodComment: "Very responsive" | null,
  coDeployedTanods: [
    { uid: "tanod_uid_2", name: "Pedro Reyes" }
  ]
}
```

---

## How to Fetch Data for the Logged-In Tanod

### Step 1: Get Current Deployment (Real-time)

Listen to the tanod's own employee document. This is the **primary source** — no extra queries needed.

```javascript
import { doc, onSnapshot } from 'firebase/firestore';
import { firestore } from './firebaseConfig';

// currentUserUid = the UID of the logged-in tanod (from Firebase Auth)
const tanodRef = doc(firestore, 'employee', currentUserUid);

const unsubscribe = onSnapshot(tanodRef, (snapshot) => {
  if (!snapshot.exists()) return;

  const data = snapshot.data();
  const { deploymentStatus, deployedTo } = data;

  if (deploymentStatus === 'deployed' && deployedTo) {
    // Tanod has an active deployment
    const {
      complaintKey,
      userId,
      complainantName,
      type,
      incidentPurok,
      description,
      deployedAt,
      coDeployedTanods,    // Array of { uid, name }
    } = deployedTo;

    // Display the complaint info
    console.log('Assigned Complaint:', description);
    console.log('Complainant:', complainantName);
    console.log('Type:', type);
    console.log('Purok:', incidentPurok);
    console.log('Deployed At:', deployedAt);

    // Display co-deployed tanods
    if (coDeployedTanods && coDeployedTanods.length > 0) {
      console.log('Deployed With:');
      coDeployedTanods.forEach((t) => {
        console.log(`  - ${t.name} (${t.uid})`);
      });
    }
  } else {
    // No active deployment
    console.log('No current deployment. Status: available');
  }
});

// Don't forget to unsubscribe when component unmounts
// unsubscribe();
```

### Step 2 (Optional): Get Full Complaint Details

If you need more info from the actual complaint doc (e.g., evidence photo, exact timestamp, incident location):

```javascript
import { doc, getDoc } from 'firebase/firestore';

// Use userId and complaintKey from the tanod's deployedTo field
const complaintRef = doc(
  firestore,
  'users',
  deployedTo.userId,
  'userComplaints',
  deployedTo.complaintKey
);

const complaintSnap = await getDoc(complaintRef);
if (complaintSnap.exists()) {
  const complaint = complaintSnap.data();
  // complaint.message, complaint.evidencePhoto, complaint.incidentLocation, etc.
}
```

### Step 3 (Optional): Get Deployment History

To show the tanod their past resolved deployments:

```javascript
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';

const historyRef = collection(firestore, 'employee', currentUserUid, 'deploymentHistory');
const q = query(historyRef, orderBy('resolvedAt', 'desc'));

const unsubHistory = onSnapshot(q, (snapshot) => {
  const history = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  history.forEach((entry) => {
    console.log(`[${entry.status}] ${entry.type} - ${entry.complainantName}`);
    console.log(`  Deployed: ${entry.deployedAt} → Resolved: ${entry.resolvedAt}`);
    console.log(`  Rating: ${entry.tanodRating || 'No rating yet'}`);
    if (entry.coDeployedTanods?.length > 0) {
      console.log(`  Deployed With: ${entry.coDeployedTanods.map(t => t.name).join(', ')}`);
    }
  });
});
```

---

## Summary: What Each Tanod Sees

| Data | Source | How |
|------|--------|-----|
| Current deployment status | `employee/{uid}.deploymentStatus` | Real-time listener |
| Complaint details (basic) | `employee/{uid}.deployedTo` | Same listener |
| Co-deployed tanods | `employee/{uid}.deployedTo.coDeployedTanods` | Same listener |
| Full complaint (photo, location) | `users/{userId}/userComplaints/{key}` | Single `getDoc` call |
| Past deployments | `employee/{uid}/deploymentHistory/*` | Collection listener |
| Citizen feedback/rating | `employee/{uid}/deploymentHistory/{key}.tanodRating` | Same history listener |

---

## Key Points

- **No extra Firestore collection needed.** Everything the tanod needs is either on their `employee` doc or the complaint doc.
- **`coDeployedTanods`** is always relative — it lists everyone *except* the current tanod. So each tanod sees only their partner(s).
- **Backward compatible** — old single-tanod complaints still work via the `deployedTanodUid`/`deployedTanodName` fallback fields.
- **Minimum 2 tanods** are enforced on the admin side (Notiftable.jsx) during deployment.
