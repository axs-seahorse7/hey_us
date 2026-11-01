# Dear Us

A private, shared memory space for couples: photos, videos, voice notes, written memories, and collaborative albums.

## Stack

- **Client:** React + Vite
- **API:** Node.js + Express
- **Metadata:** MongoDB + Mongoose
- **Media:** Amazon S3 with presigned URLs
- **Production hosting:** Amazon EC2

## Start locally

1. Install Node.js 20 or later.
2. Run `npm install` in this folder.
3. Copy `server/.env.example` to `server/.env` and add its values.
4. Run `npm run dev`.

The first delivery target is a couple space, partner invite, secure S3 media upload, and chronological shared gallery.
