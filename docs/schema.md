# PFE Connect — DynamoDB schema (contract v1)

Source: cahier des charges finale, section 8. This file is the frozen contract for tables, keys, indexes, enums and transactions. Changes after the `contract-v1` tag need approval from all three members.

## 1. Global rules

| Rule | Value |
|---|---|
| Billing | On-demand (`PAY_PER_REQUEST`) on every table and index |
| IDs | UUID v4 strings (`uuid.uuid4()`), except composite sort keys below |
| Timestamps | ISO-8601 UTC strings, e.g. `2026-10-10T14:30:00Z` (sort lexicographically) |
| Weeks | ISO week string, e.g. `2026-W42` |
| Enums | Uppercase strings, defined once in `lambdas/common/enums.py` and reused in `openapi.yaml` |
| Reads | `GetItem` or `Query` only. No `Scan` outside `seed.py` / `teardown.py` |
| Table names | `pfe-connect-<Table>` (e.g. `pfe-connect-Users`), passed to Lambdas as env vars `TABLE_USERS`, `TABLE_OFFERS`, … |
| GSI projection | `ALL` everywhere (items are small). Revisit `Conventions` if `renderedText` grows |
| Reserved words | `status`, `state`, `name`, `type`, `year`, `timestamp`, `read` are DynamoDB reserved words: **always** use `ExpressionAttributeNames` (`#s`, `#t`, …) |
| Sparse indexes | An index key attribute that is absent = item absent from the index. Set the attribute to enter the queue, `REMOVE` it to leave |
| Writes touching several items | `transact_write_items` with `ConditionExpression` (max 100 items; our largest is about 8) |
| Authorization | Every Lambda checks the JWT role **and** that the item belongs to the caller (`studentId`, `companyId`, `teacherId`, `etab`) |

## 2. Enums

| Enum | Values |
|---|---|
| Role | `ETU`, `ENT`, `ENS`, `RESP`, `ADM` |
| OfferStatus | `OPEN`, `CLOSED`, `FILLED` |
| ApplicationStatus | `PENDING`, `VIEWED`, `IN_PROGRESS`, `ACCEPTED`, `REJECTED`, `CONFIRMED`, `DECLINED`, `WITHDRAWN` |
| Active applications | `PENDING`, `VIEWED`, `IN_PROGRESS`, `ACCEPTED` (max 5 per student) |
| ConventionState | `DRAFT`, `SUBMITTED`, `SIGNED_STUDENT`, `SIGNED_COMPANY`, `APPROVED` |
| ConventionEventType | `SUBMITTED`, `SIGNED`, `REJECTED`, `RESUBMITTED`, `APPROVED` |
| SupervisionStatus | `REQUESTED`, `ACCEPTED`, `DECLINED`, `ASSIGNED` |
| ReportStatus | `UNDER_REVIEW`, `CHANGES_REQUESTED`, `VALIDATED` |
| ReportDecision | `APPROVED`, `CHANGES_REQUESTED` |

## 3. Lambda functions (referenced below)

`auth` (login, `/me`, CV upload URL, teacher expertise) · `offers` · `recommender` (batch + trigger) · `applications` · `conventions` (incl. templates and deadline settings) · `supervision` · `journals` · `reports` (API) · `report-ingest` (S3 event) · `notifier` (SNS → Notifications) · `notifications` (API) · `reminders` (EventBridge) · `verify` · `admin`

## 4. Tables

### 4.1 Users
**Key:** PK `userId` (S)

| Attribute | Type | Notes |
|---|---|---|
| `email` | S | Lowercased. Uniqueness is enforced by an `EMAIL` item in `Reference` (see 4.12), written in the same transaction as the user |
| `passwordHash` | S | PBKDF2-SHA256 |
| `role` | S | Role enum |
| `etab` | S | Institution id (from `Reference`). Companies: omit |
| `firstName`, `lastName` | S | |
| `department`, `specialty` | S | ETU |
| `skills` | SS | Normalized: lowercase, no accents. ETU |
| `gouvernorat` | S | ETU |
| `cvKey` | S | S3 key. ETU |
| `expertise` | SS | ENS |
| `companyName` | S | ENT |
| `activeCount` | N | ETU. Number of active applications, 0..5 |
| `conventionId` | S | ETU. Set at confirmation |
| `stageEtab` | S | ETU, **sparse**. = `etab`, set when the convention is approved |
| `lastJournal` | S | ETU, with `stageEtab`. Initialized to the approval date, updated on each journal entry |
| `sansStageEtab` | S | ETU, **sparse**. = `etab` while no internship is confirmed, removed at confirmation |
| `createdAt` | S | |

| GSI | Key | Serves |
|---|---|---|
| `byEtabRole` | PK `etab`, SK `role` | Teachers of an institution (filter by `expertise` in code) |
| `internsByLastJournal` | PK `stageEtab`, SK `lastJournal` | Interns with no journal for 2 weeks |
| `noInternshipByEtab` | PK `sansStageEtab` | Students without internship near the deadline |

**Read:** all Lambdas (authorizer lookup, ownership checks). **Write:** `auth` (signup, profile), `applications` (`activeCount`), `conventions` (`stageEtab`, `conventionId`), `journals` (`lastJournal`), `admin`.

### 4.2 Offers
**Key:** PK `offerId` (S)

| Attribute | Type | Notes |
|---|---|---|
| `companyId` | S | |
| `title`, `description` | S | |
| `keywords` | SS | Normalized |
| `skills` | SS | Normalized |
| `gouvernorat` | S | |
| `durationWeeks` | N | |
| `status` | S | OfferStatus |
| `gouvernoratCreatedAt` | S | `{gouvernorat}#{createdAt}` |
| `similar` | L | `[{subjectId, score}]` computed at publication, warning only |
| `createdAt` | S | |

| GSI | Key | Serves |
|---|---|---|
| `byCompany` | PK `companyId`, SK `createdAt` | Offers of a company |
| `openByRegion` | PK `status`, SK `gouvernoratCreatedAt` | Open offers (`status = OPEN`), filtered by gouvernorat (`begins_with`). One partition is fine at our scale |

**Read:** `offers`, `applications`, `recommender`. **Write:** `offers`.

### 4.3 Applications
**Key:** PK `studentId` (S), SK `offerId` (S)

| Attribute | Type | Notes |
|---|---|---|
| `companyId` | S | Copied from the offer (ownership check without extra read) |
| `status` | S | ApplicationStatus |
| `createdAt`, `updatedAt` | S | |
| `viewedAt` | S | Set on first company read |

| GSI | Key | Serves |
|---|---|---|
| `byOffer` | PK `offerId`, SK `studentId` | Applications received for an offer |

**Read/write:** `applications`. **Read:** `recommender` (exclude already-applied offers).

### 4.4 Conventions
**Key:** PK `conventionId` (S, random UUID, also the public QR id)

| Attribute | Type | Notes |
|---|---|---|
| `studentId`, `companyId`, `offerId`, `etab` | S | |
| `state` | S | ConventionState |
| `renderedText` | S | Template filled with dynamic fields |
| `templateVersion` | N | |
| `pdfKey`, `pdfSha256` | S | Unsigned PDF. Signatures are bound to this hash |
| `finalPdfKey`, `finalSha256` | S | Final copy with QR code, set at `APPROVED` |
| `shortRef` | S | Short public reference shown on `/verify` |
| `currentActorId` | S | **Sparse.** Student / company id, or `RESP#{etab}` for the responsable step. Removed at `APPROVED` |
| `stepSince` | S | Timestamp of the current step. With `currentActorId` and `stuckEtab` |
| `rejectionReason` | S | Mandatory on reject |
| `noSupervisorEtab` | S | **Sparse.** = `etab`, set at `APPROVED`, removed when a supervisor is accepted or assigned |
| `approvedAt` | S | |
| `createdAt` | S | |

| GSI | Key | Serves |
|---|---|---|
| `byCompany` | PK `companyId` | Conventions of a company |
| `pendingByActor` | PK `currentActorId`, SK `stepSince` | Conventions waiting for an actor's signature |
| `stuckByEtab` | PK `etab`, SK `stepSince` | Conventions blocked more than 5 days (sparse: only non-approved) |
| `noSupervisor` | PK `noSupervisorEtab`, SK `approvedAt` | Approved conventions without supervisor |

`stuckByEtab` is keyed on `etab` + `stepSince`: drop both `currentActorId` and `stepSince` on approval so the item leaves both sparse indexes.

**Read:** `conventions`, `verify` (`GetItem`, public fields only), `reminders`, `supervision`. **Write:** `conventions`, `supervision` (removes `noSupervisorEtab`).

### 4.5 ConventionEvents
**Key:** PK `conventionId` (S), SK `timestamp#type` (S, e.g. `2026-10-10T14:30:00Z#SIGNED`)

| Attribute | Type | Notes |
|---|---|---|
| `type` | S | ConventionEventType |
| `actorId`, `actorRole` | S | |
| `fromState`, `toState` | S | |
| `pdfSha256` | S | Hash signed (for `SIGNED`) |
| `reason` | S | For `REJECTED` |

**Write (append only):** `conventions`. **Read:** `conventions` (audit endpoint).

### 4.6 Supervisions
**Key:** PK `studentId` (S): one supervision record per student

| Attribute | Type | Notes |
|---|---|---|
| `teacherId` | S | |
| `status` | S | SupervisionStatus |
| `etab` | S | |
| `requestedAt`, `respondedAt` | S | |
| `assignedBy` | S | Responsable id when `ASSIGNED` |

A decline is overwritten by the student's next request (no history kept; add an event log later if needed).

| GSI | Key | Serves |
|---|---|---|
| `byTeacher` | PK `teacherId`, SK `status` | Requests of a teacher (`status = REQUESTED`) and their supervised students (`ACCEPTED`, `ASSIGNED`) |

**Read/write:** `supervision`. **Read:** `journals`, `reports` (is this teacher the supervisor?), `reminders`.

### 4.7 Journals
**Key:** PK `studentId` (S), SK `week` (S, `2026-W42`)

| Attribute | Type | Notes |
|---|---|---|
| `content` | S | |
| `submittedAt` | S | |
| `validated` | BOOL | Company validation |
| `validatedBy`, `validatedAt`, `comment` | S | |

**Read/write:** `journals`.

### 4.8 Reports
**Key:** PK `studentId` (S), SK `version` (N, starts at 1)

| Attribute | Type | Notes |
|---|---|---|
| `s3Key`, `sha256` | S | Written by `report-ingest` |
| `status` | S | ReportStatus |
| `companyId`, `teacherId` | S | Reviewers, copied from the convention and supervision |
| `companyDecision`, `teacherDecision` | S | ReportDecision, absent until decided |
| `companyComment`, `teacherComment` | S | Mandatory for `CHANGES_REQUESTED` |
| `pendingCompanyId` | S | **Sparse.** = `companyId` until the company decides |
| `pendingTeacherId` | S | **Sparse.** = `teacherId` until the teacher decides |
| `submittedAt` | S | |

| GSI | Key | Serves |
|---|---|---|
| `pendingForCompany` | PK `pendingCompanyId`, SK `submittedAt` | Reports a company must review |
| `pendingForTeacher` | PK `pendingTeacherId`, SK `submittedAt` | Reports a teacher must review |

A new version is a **new item** with fresh `pending*` attributes, so decisions reset by construction. Previous versions stay for audit.

**Write:** `report-ingest` (create), `reports` (decisions). **Read:** `reports`.

### 4.9 Notifications
**Key:** PK `userId` (S), SK `createdAt#id` (S)

| Attribute | Type | Notes |
|---|---|---|
| `type`, `title`, `body` | S | |
| `refType`, `refId` | S | e.g. `CONVENTION`, `<conventionId>` |
| `read` | BOOL | |
| `ttl` | N | Optional, epoch seconds (90 days), enable DynamoDB TTL on this attribute |

**Write:** `notifier` (create), `notifications` (mark read). **Read:** `notifications`.

### 4.10 Recommendations
**Key:** PK `studentId` (S), SK `rank` (N, 1..5)

| Attribute | Type | Notes |
|---|---|---|
| `offerId` | S | |
| `score` | N | 0..100 |
| `computedAt` | S | |

Recompute = one `transact_write_items` replacing the 5 items.

**Write:** `recommender`. **Read:** `offers` (the recommendations endpoint).

### 4.11 SubjectsArchive
**Key:** PK `year` (N), SK `subjectId` (S)

| Attribute | Type | Notes |
|---|---|---|
| `title`, `description` | S | |
| `tokens` | SS | Normalized stems, used by the similarity function |
| `keywords` | SS | |

Loaded by `seed.py` (5 years). **Read:** `offers` (similarity check queries the 5 years).

### 4.12 Reference
**Key:** PK `type` (S), SK `id` (S)

| `type` | `id` | Attributes |
|---|---|---|
| `ETAB` | `{etabId}` | `name` |
| `DEPARTMENT` | `{etabId}#{deptId}` | `name` |
| `SPECIALTY` | `{deptId}#{specialtyId}` | `name`, `compatibleWith` (SS of offer domains) |
| `CONV_TEMPLATE` | `{etabId}#v{n}` | `text` (with `{{placeholders}}`), `createdAt` |
| `EMAIL` | lowercased email | `userId`. **Uniqueness lock + login lookup** (written at signup) |
| `SETTINGS` | `{etabId}` | `deadline` (date), `deadlineEnabled` (BOOL), `templateVersion` (N) |

**Read:** all. **Write:** `conventions` (templates, settings), `admin` (institutions, departments, specialties), `auth` (`EMAIL` at signup).

## 5. Access patterns

| Need | Table / index | Lambda |
|---|---|---|
| Login | `Reference` GetItem (`EMAIL`, email) → `Users` GetItem | `auth` |
| Teachers of an institution by expertise | `Users.byEtabRole` (`etab`, `ENS`), filter on `expertise` | `supervision` |
| Student's applications | `Applications` by `studentId` | `applications` |
| Applications received for an offer | `Applications.byOffer` | `applications` |
| Company's offers | `Offers.byCompany` | `offers` |
| Open offers by gouvernorat | `Offers.openByRegion` | `offers` |
| Conventions waiting for an actor | `Conventions.pendingByActor` | `conventions` |
| Company's conventions | `Conventions.byCompany` | `conventions` |
| Convention audit | `ConventionEvents` by `conventionId` | `conventions` |
| Approved, no supervisor | `Conventions.noSupervisor` | `supervision` |
| Teacher's requests | `Supervisions.byTeacher` (`REQUESTED`) | `supervision` |
| Student's journals | `Journals` by `studentId` | `journals` |
| Reports to review | `Reports.pendingForCompany` / `pendingForTeacher` | `reports` |
| Versions and status of a report | `Reports` by `studentId` | `reports` |
| Conventions blocked 5+ days | `Conventions.stuckByEtab` (`stepSince < now-5d`) | `reminders` |
| Interns without journal for 2 weeks | `Users.internsByLastJournal` (`lastJournal < now-14d`) | `reminders` |
| Students without internship | `Users.noInternshipByEtab` | `reminders` |
| Notifications | `Notifications` by `userId` (descending) | `notifications` |
| Recommendations | `Recommendations` by `studentId` | `offers` |
| Similarity archive | `SubjectsArchive` by `year` | `offers` |
| QR verification | `Conventions` `GetItem` by `conventionId` | `verify` |

## 6. Transactions

| Operation | Items | Conditions |
|---|---|---|
| **Signup** | `Users` (put), `Reference` (put `EMAIL`) | `attribute_not_exists` on both. Failure → 409 `EMAIL_TAKEN`. Public roles only: `ETU`, `ENT`, `ENS` (`RESP` and `ADM` are created by `admin` / seed) |
| **Apply** | `Users` (`activeCount + 1`), `Applications` (put) | `activeCount < 5`; application does not exist. Failure → 409 |
| **Leave active set** (`REJECTED`, `DECLINED`, `WITHDRAWN`) | `Applications` (status), `Users` (`activeCount - 1`) | Current status is active; `activeCount > 0` |
| **Confirm** (about 7 items) | `Applications` (`CONFIRMED`), up to 4 other active `Applications` (`WITHDRAWN`), `Users` (`activeCount = 0`, `conventionId`, remove `sansStageEtab`), `Conventions` (put, `SUBMITTED`), `ConventionEvents` (put) | Application is `ACCEPTED`; `activeCount = :n` where `:n` is the count read just before (if another apply slipped in, the transaction fails → retry once) |
| **Sign** | `Conventions` (state, `currentActorId`, `stepSince`), `ConventionEvents` (put) | `state = :expected`; signer matches `currentActorId`; `pdfSha256` unchanged |
| **Reject convention** | `Conventions` (`DRAFT`, reason), `ConventionEvents` (put) | State is one of `SUBMITTED`, `SIGNED_STUDENT`, `SIGNED_COMPANY` |
| **Approve** | `Conventions` (`APPROVED`, final PDF fields, remove `currentActorId` / `stepSince`, set `noSupervisorEtab`), `Users` (student: `stageEtab`, `lastJournal`), `ConventionEvents` (put) | `state = SIGNED_COMPANY` |
| **Report decision** | `Reports` (decision, remove `pending*`, maybe `status`), audit event | Version is the latest; this reviewer's decision still pending |
| **Supervision response / assign** | `Supervisions` (status), `Conventions` (remove `noSupervisorEtab`) | Status is `REQUESTED` (or no record, for `assign`) |

Keep `Confirm` under the 100-item limit: the 5-application cap is what bounds it, so enforce the cap in **Apply** and never raise it without rechecking.

## 7. Decisions (closed)

1. **Responsable queue key:** `RESP#{etab}`, one queue per institution, so any responsable of that institution can sign.
2. **Offers visibility:** offers are visible to every institution. `openByRegion` is keyed on `status` only; offers carry no `etab`.
3. **Supervision history:** none. One record per student, a declined request is overwritten by the next one.
4. **Signup exists:** `POST /v1/auth/signup` (public, roles `ETU`, `ENT`, `ENS`). Email uniqueness uses the `EMAIL` item in `Reference`; login reads that item instead of a GSI (strongly consistent, so signup then login always works). **The cahier needs this endpoint added to section 9.**