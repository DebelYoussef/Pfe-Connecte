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
| NotificationType | `APPLICATION_RECEIVED`, `APPLICATION_STATUS_CHANGED`, `CONVENTION_SIGNATURE_REQUIRED`, `CONVENTION_REJECTED`, `CONVENTION_APPROVED`, `CONVENTION_STUCK`, `SUPERVISION_REQUESTED`, `SUPERVISION_RESPONDED`, `SUPERVISION_ASSIGNED`, `JOURNAL_VALIDATED`, `JOURNAL_MISSING`, `NO_INTERNSHIP_DEADLINE`, `REPORT_SUBMITTED`, `REPORT_REVIEWED`, `INSTITUTION_WITHOUT_RESPONSABLE`, `DEPARTMENT_WITHOUT_SPECIALTY`, `CONVENTION_WAITING_NO_RESPONSABLE`, `ADMIN_ACCOUNT_CREATED`, `ADMIN_ROLE_GRANTED` |
| NotificationRefType | `APPLICATION`, `CONVENTION`, `SUPERVISION`, `JOURNAL`, `REPORT`, `OFFER`, `USER`, `INSTITUTION` |
| NotificationLevel | `INFO`, `WARNING`. Optional on a notification, absent = `INFO` |
| Issue kind (`Reference` ISSUE) | `INSTITUTION_WITHOUT_RESPONSABLE`, `DEPARTMENT_WITHOUT_SPECIALTY`, `CONVENTION_WAITING_NO_RESPONSABLE` (same strings as the three matching `NotificationType` values) |

The first 14 `NotificationType` values are the user-facing types derived from the flows of the contract (the spec never listed them); align them with what `notifier` really emits before merging. The last five are for administrators (see 4.9.1).

## 3. Lambda functions (referenced below)

| Lambda | Trigger | Responsibilities |
|---|---|---|
| `auth` | API | login, `/me`, CV upload URL, teacher expertise |
| `offers` | API | |
| `recommender` | batch + trigger | |
| `applications` | API | |
| `conventions` | API | incl. templates and deadline settings |
| `supervision` | API | |
| `journals` | API | |
| `reports` | API | |
| `report-ingest` | S3 event | |
| `notifier` | SNS | SNS → Notifications (the only writer of `Notifications` items) |
| `notifications` | API | |
| `reminders` | EventBridge | |
| `verify` | API (public) | |
| `admin` | API (ADM) | Users: list (4 access paths), create (same transaction as signup), patch (whitelist, own-role rule). Overview counts and worklist. Institutions, departments and specialties (writes to `Reference`). After any change to a user, institution, department or specialty it invokes `config_health` asynchronously. Publishes `ADMIN_ACCOUNT_CREATED` and `ADMIN_ROLE_GRANTED` to SNS for the other admins |
| `reference` (new) | API (public, `security: []`, throttled like `verify`) | Read-only `GET /v1/reference/institutions`, `/departments`, `/specialties`. Reads `Reference` only |
| `config_health` (new) | EventBridge, once a day + asynchronous invocation by `admin`. **No API route** | Runs the three configuration checks (4.9.1), creates and deletes `ISSUE` items in `Reference`, publishes one SNS message per newly opened issue for `notifier` |

## 4. Tables

### 4.1 Users
**Key:** PK `userId` (S)

| Attribute | Type | Notes |
|---|---|---|
| `email` | S | Lowercased. Uniqueness is enforced by an `EMAIL` item in `Reference` (see 4.12), written in the same transaction as the user |
| `passwordHash` | S | PBKDF2-SHA256 |
| `role` | S | Role enum |
| `etab` | S | Institution id (from `Reference`). Companies and administrators: omit |
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
| `createdAt` | S | Sort key of `byRole` and `allByCreatedAt` |
| `gsiAll` | S | Constant `"ALL"`, set on **every** user (signup, admin creation, seed). Partition key of `allByCreatedAt` |

| GSI | Key | Serves |
|---|---|---|
| `byEtabRole` | PK `etab`, SK `role` | Teachers of an institution (filter by `expertise` in code) |
| `internsByLastJournal` | PK `stageEtab`, SK `lastJournal` | Interns with no journal for 2 weeks |
| `noInternshipByEtab` | PK `sansStageEtab` | Students without internship near the deadline |
| `byRole` (new) | PK `role`, SK `createdAt` | Admin list by role, count by role, all `ADM` users |
| `allByCreatedAt` (new) | PK `gsiAll` (= `ALL`), SK `createdAt` | Admin list with no filter, accounts of the last 7 days |

**Queries served by the new indexes**

| Query | Index and condition |
|---|---|
| Admin list by role | `byRole`, `role = :r`, newest first |
| Admin list by role and institution | `byEtabRole`, `etab = :e AND role = :r` |
| Admin list with no filter | `allByCreatedAt`, `gsiAll = "ALL"`, newest first |
| Accounts created in the last 7 days | `allByCreatedAt`, `gsiAll = "ALL" AND createdAt >= :now-7d`, `Select=COUNT` |
| Count users by role | `byRole`, one `Select=COUNT` query per role (5 queries), follow `LastEvaluatedKey` |
| Find all `ADM` users (to notify them) | `byRole`, `role = "ADM"` |

Administrators have **no `etab`**, so they are absent from `byEtabRole` (sparse by construction): that index cannot list or find them, which is why `byRole` exists. `allByCreatedAt` uses a single constant partition: fine at our scale (same reasoning as `openByRegion`).

**Deployment:** adding GSIs and the `gsiAll` attribute to the existing `Users` table requires a **teardown, deploy and seed** (existing items have no `gsiAll`, so they would never enter `allByCreatedAt`).

**Read:** all Lambdas (authorizer lookup, ownership checks), `config_health` (`byEtabRole` for RESP, `byRole` for ADM). **Write:** `auth` (signup, profile), `applications` (`activeCount`), `conventions` (`stageEtab`, `conventionId`), `journals` (`lastJournal`), `admin`.

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
| `type`, `title`, `body` | S | `type` is a `NotificationType` |
| `refType`, `refId` | S | `refType` is a `NotificationRefType`. e.g. `CONVENTION`, `<conventionId>` |
| `level` | S | Optional, `INFO` or `WARNING`. Absent = `INFO`. Set on administrator notifications |
| `read` | BOOL | |
| `ttl` | N | Optional, epoch seconds (90 days), enable DynamoDB TTL on this attribute |

**Write:** `notifier` (create), `notifications` (mark read). **Read:** `notifications`.

#### 4.9.1 Notifications des administrateurs

| `type` | `refType` / `refId` | `level` | Trigger |
|---|---|---|---|
| `INSTITUTION_WITHOUT_RESPONSABLE` | `INSTITUTION` / institution id | `WARNING` | An institution has no `RESP` (`Users.byEtabRole`, `etab`, `RESP`, empty). Detected by the daily `config_health` check and after admin changes (RESP moved or role changed, institution created) |
| `DEPARTMENT_WITHOUT_SPECIALTY` | `INSTITUTION` / department id (`{etabId}#{deptId}`) | `WARNING` | A department has no `SPECIALTY` item (`Reference` query `SPECIALTY`, prefix `{departmentId}#`, empty). Same two triggers (department or specialty created or changed) |
| `CONVENTION_WAITING_NO_RESPONSABLE` | `CONVENTION` / `conventionId` | `WARNING` | A convention waits in `pendingByActor` for `RESP#{etab}` while that institution has no `RESP`. Same two triggers |
| `ADMIN_ACCOUNT_CREATED` | `USER` / id of the new admin | `INFO` | An `ADM` account is created through `POST /v1/admin/users`. Sent to the **other** admins (not the creator, not the new account) |
| `ADMIN_ROLE_GRANTED` | `USER` / id of the promoted user | `INFO` | `PATCH /v1/admin/users/{id}` changes a role **to** `ADM`. Sent to the **other** admins (not the caller, not the promoted user) |

The three "issue" types go to **every** `ADM` user (`Users.byRole`), once per issue (dedupe rule in 4.12). The "issue" types are checked daily by `config_health` (EventBridge) and re-checked right after admin changes (the `admin` Lambda invokes `config_health` asynchronously). Producers (`config_health`, `admin`) publish to SNS with the recipient ids; `notifier` writes the `Notifications` items.

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
| `ISSUE` (new) | `{kind}#{refId}` | `openedAt`, `notifiedAt` |

**`id` versus `code`.** The API exposes a `code` next to the `id` of departments and specialties. `code` is the last segment of the `id` and is the value stored in `Users.department` and `Users.specialty`. In `SPECIALTY`, `{deptId}` in the id is the **full department id** (`{etabId}#{deptId}`), so ids never collide between institutions: `ETAB1#INFO#IA` has `code = IA`.

| Item | `id` | `code` (sent in `department` / `specialty`) |
|---|---|---|
| `DEPARTMENT` | `ETAB1#INFO` | `INFO` |
| `SPECIALTY` | `ETAB1#INFO#IA` | `IA` |

**`ISSUE` items** track open configuration problems. `kind` is one of `INSTITUTION_WITHOUT_RESPONSABLE`, `DEPARTMENT_WITHOUT_SPECIALTY`, `CONVENTION_WAITING_NO_RESPONSABLE`; `refId` is the institution id, the department id or the convention id respectively. Example id: `INSTITUTION_WITHOUT_RESPONSABLE#ETAB1`. Attributes: `openedAt` (detection time), `notifiedAt` (set once the notification was published).

**Dedupe rule.** `config_health` puts the `ISSUE` item with `ConditionExpression attribute_not_exists(#t) AND attribute_not_exists(id)` (`type` is a reserved word). Only the call that creates the item sends the notification, then sets `notifiedAt`. If the item already exists the problem is already known: no new notification. When a later check finds the problem resolved, it **deletes** the item, so a problem that comes back creates a new item and a new notification. An item without `notifiedAt` (fan-out failed) is notified again by the next check.

**Read:** all (`reference` reads `ETAB`, `DEPARTMENT`, `SPECIALTY` only; `admin` overview reads `ISSUE`). **Write:** `conventions` (templates, settings), `admin` (institutions, departments, specialties, `EMAIL` when creating a user), `auth` (`EMAIL` at signup), `config_health` (`ISSUE` create and delete).

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
| Admin list, exact e-mail | `Reference` GetItem (`EMAIL`, email) → `Users` GetItem | `admin` |
| Admin list, role + institution | `Users.byEtabRole` (`etab`, `role`) | `admin` |
| Admin list, role only | `Users.byRole` (`role`), newest first | `admin` |
| Admin list, no filter | `Users.allByCreatedAt` (`gsiAll = "ALL"`), newest first | `admin` |
| Admin list, institution only | `Users.byEtabRole` (`etab`, no sort-key condition) | `admin` |
| Users created in the last 7 days | `Users.allByCreatedAt` (`createdAt >= now-7d`, `COUNT`) | `admin` |
| Count users by role | `Users.byRole`, one `COUNT` query per role | `admin` |
| All admins (to notify them) | `Users.byRole` (`ADM`) | `admin`, `config_health` |
| Open issues for the admin home | `Reference` Query `ISSUE`, `id begins_with {kind}#` (names by `BatchGetItem` on `ETAB` / `DEPARTMENT`) | `admin` |
| Public institutions | `Reference` Query `ETAB` | `reference` |
| Public departments of an institution | `Reference` Query `DEPARTMENT`, `id begins_with {etab}#` | `reference` |
| Public specialties of a department | `Reference` Query `SPECIALTY`, `id begins_with {departmentId}#` | `reference` |
| Check: institutions without RESP | `Reference` Query `ETAB`, then `Users.byEtabRole` (`etab`, `RESP`), `Limit 1` per institution | `config_health` |
| Check: departments without specialty | `Reference` Query `DEPARTMENT`, then Query `SPECIALTY` (`begins_with {departmentId}#`), `Limit 1` per department | `config_health` |
| Check: conventions waiting for a missing RESP | `Conventions.pendingByActor` (`RESP#{etab}`) for each institution without RESP | `config_health` |
| Issue opened / resolved | `Reference` conditional put / delete of `ISSUE` | `config_health` |
| Recommendations | `Recommendations` by `studentId` | `offers` |
| Similarity archive | `SubjectsArchive` by `year` | `offers` |
| QR verification | `Conventions` `GetItem` by `conventionId` | `verify` |

## 6. Transactions

| Operation | Items | Conditions |
|---|---|---|
| **Signup** | `Users` (put, with `gsiAll = "ALL"`), `Reference` (put `EMAIL`) | `attribute_not_exists` on both. Failure → 409 `EMAIL_TAKEN`. Public roles only: `ETU`, `ENT`, `ENS` (`RESP` and `ADM` are created by `admin` / seed) |
| **Admin creates a user** | `Users` (put, with `gsiAll = "ALL"`), `Reference` (put `EMAIL`) | Same transaction as **Signup**: `attribute_not_exists` on both, failure → 409 `EMAIL_TAKEN`. Any role, including `RESP` and `ADM` |
| **Admin updates a user** (single item, not a transaction) | `Users` (update of whitelisted fields only) | `attribute_exists(userId)`; caller ≠ target when `role` changes (403 `CANNOT_CHANGE_OWN_ROLE`); no check on "last RESP" (allowed, raises a notification) |
| **Open a configuration issue** (single item, not a transaction) | `Reference` (put `ISSUE`) | `attribute_not_exists` on the key; ConditionalCheckFailed means already known, no notification |
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

## 8. Error codes used by the admin and reference features

All errors use `{ error: { code, message, details, requestId } }`.

| HTTP | `code` | Where | Notes |
|---|---|---|---|
| 400 | `VALIDATION_ERROR` | all new operations | Unknown field, malformed `email`, bad cursor, missing `etab` (`/reference/departments`) or `department` (`/reference/specialties`), `etab` sent for an ADM |
| 401 | `UNAUTHORIZED` | all `admin` operations | Code name to align with `common/errors.py` (the spec only shows the HTTP status) |
| 403 | `FORBIDDEN` | all `admin` operations | Caller is not an ADM. Code name to align, as above |
| 403 | `CANNOT_CHANGE_OWN_ROLE` | `PATCH /v1/admin/users/{id}` | New |
| 404 | `NOT_FOUND` | `PATCH /v1/admin/users/{id}` | Code name to align, as above |
| 409 | `EMAIL_TAKEN` | `POST /v1/admin/users` (and signup) | Transaction condition failed on `Users` or `Reference` `EMAIL` |
| 429 | `RATE_LIMITED` | `/v1/reference/*` | Code name to align, as above |

## 9. Points to confirm

1. **Notification types:** the spec lists none (`type` was a free string). The 14 user-facing values in `NotificationType` are derived from the flows; replace them with the real list of `notifier`.
2. **`SPECIALTY` id:** written as `{deptId}#{specialtyId}`. This section reads `{deptId}` as the full department id (`ETAB1#INFO#IA`). If the seed uses the short code, two institutions with the same department and specialty codes would collide.
3. **Codes:** `department` code = last segment of the `DEPARTMENT` id, `specialty` code = last segment of the `SPECIALTY` id, and these are what `Users.department` / `Users.specialty` store. How a code is chosen when an admin creates a department or specialty (`DepartmentInput` and `SpecialtyInput` have only `name`) is not specified.
4. **`etab` by role:** required for ETU, ENS, RESP; omitted for ENT and ADM; promoting a user to ADM removes `etab`.
5. **Admin list:** `etab` alone is allowed (`byEtabRole` on the partition key only).
6. **Department issue:** no `DEPARTMENT` value exists in `NotificationRefType`, so `DEPARTMENT_WITHOUT_SPECIALTY` uses `INSTITUTION` with the department id as `refId`. Adding a `DEPARTMENT` ref type would be cleaner.
7. **Overview freshness:** the three lists come from `ISSUE` items, so they reflect the last check; `since` is `openedAt` (detection time), not the convention's `stepSince`.
8. **Producers of admin notifications** publish to SNS with explicit recipient ids and `notifier` stays the only writer of `Notifications`.
9. **Own role:** the 403 applies only when the requested role differs from the current one; sending the same role is accepted as a no-op.
10. **Unknown filter values** on the public reference lists return `200` with an empty list, not 404.
11. **Role changes** do not clean up related data (a former student's applications, a former RESP's pending queue).