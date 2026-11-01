# Product plan: Dear Us

## Product promise

Dear Us is a private shared archive for two people. It should feel warm and personal, while behaving like a dependable cloud backup.

## MVP

1. Account creation and sign-in.
2. A private couple space with two members.
3. Partner invitation by expiring link.
4. Photos, videos, audio/voice notes, and text memories.
5. A chronological shared gallery and collaborative albums.
6. Reactions and comments.
7. Expiring secure links for selected albums.

## Later ideas

- On-this-day reminders
- Map of memories
- Time capsules that unlock on a chosen date
- Audio transcription and captions
- Memory-book / archive export
- Milestones, countdowns, and a shared bucket list

## Product rules

- Content is private by default.
- Each member has equal access to the couple space.
- The browser uploads media directly to S3 using short-lived presigned URLs.
- Members can export their own content. Separation and deletion rules must be explicit before launch.

## Initial data models

- `User`: profile, email, password hash, avatar
- `CoupleSpace`: name, members, settings
- `Invitation`: space, recipient email, token hash, expiry, status
- `Memory`: space, author, type, S3 object key, caption, occurredAt, visibility
- `Album`: space, title, cover, memory IDs, sharing settings
- `Comment` and `Reaction`: memory, author, content/type
