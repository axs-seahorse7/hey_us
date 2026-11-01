import { Folder } from '../models/Folder.js';
import { Media } from '../models/Media.js';

const systemFolders = [
  { name: 'Recents', systemKey: 'recents' },
  { name: 'Memories', systemKey: 'memories' },
  { name: 'Pictures', systemKey: 'pictures' },
  { name: 'Notes', systemKey: 'notes' },
  { name: 'Videos', systemKey: 'videos' },
];

function normalizeName(name) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

function parseFolderName(value) {
  if (typeof value !== 'string') return null;

  const name = value.trim().replace(/\s+/g, ' ');
  if (!name || name.length > 80) return null;

  return name;
}

async function ensureSystemFolders(owner) {
  await Promise.all(
    systemFolders.map((folder) => Folder.findOneAndUpdate(
      { owner, systemKey: folder.systemKey },
      {
        $setOnInsert: {
          owner,
          name: folder.name,
          normalizedName: normalizeName(folder.name),
          kind: 'system',
          systemKey: folder.systemKey,
        },
      },
      { upsert: true, new: true },
    )),
  );
}

async function serializeFolder(folder) {
  const itemCount = await Media.countDocuments({
    folder: folder._id,
    status: 'uploaded',
    $or: [{ deletedAt: null }, { deletedAt: { $exists: false } }],
  });

  return {
    ...folder.toJSON(),
    itemCount,
  };
}

export async function listFolders(request, response, next) {
  try {
    await ensureSystemFolders(request.user.id);

    const folders = await Folder.find({ owner: request.user.id })
      .sort({ kind: 1, createdAt: 1 });
    const result = await Promise.all(folders.map(serializeFolder));

    response.json({ folders: result });
  } catch (error) {
    console.log("ERR IN GET FOLDER", error)
    next(error);
  }
}

export async function createFolder(request, response, next) {
  try {
    const name = parseFolderName(request.body.name);
    if (!name) {
      return response.status(400).json({ message: 'Folder names must be between 1 and 80 characters.' });
    }

    const folder = await Folder.create({
      owner: request.user.id,
      name,
      normalizedName: normalizeName(name),
      kind: 'custom',
    });

    return response.status(201).json({ folder: await serializeFolder(folder) });
  } catch (error) {
    if (error.code === 11000) {
      console.log('DUPLICATE KEY:', error.keyValue);
      console.log('DUPLICATE ERROR:', error);

      return response.status(409).json({
        message: 'A folder with this name already exists.',
      });
    }

    return next(error);
  }
}

export async function updateFolder(request, response, next) {
  try {
    const name = parseFolderName(request.body.name);
    if (!name) {
      return response.status(400).json({ message: 'Folder names must be between 1 and 80 characters.' });
    }

    const folder = await Folder.findOne({
      _id: request.params.folderId,
      owner: request.user.id,
    });

    if (!folder) return response.status(404).json({ message: 'Folder not found.' });
    if (folder.kind === 'system') {
      return response.status(400).json({ message: 'Default folders cannot be renamed.' });
    }

    folder.name = name;
    folder.normalizedName = normalizeName(name);
    await folder.save();

    return response.json({ folder: await serializeFolder(folder) });
  } catch (error) {
    if (error.code === 11000) {
      return response.status(409).json({ message: 'A folder with this name already exists.' });
    }

    return next(error);
  }
}

export async function deleteFolder(request, response, next) {
  try {
    const folder = await Folder.findOne({
      _id: request.params.folderId,
      owner: request.user.id,
    });

    if (!folder) return response.status(404).json({ message: 'Folder not found.' });
    if (folder.kind === 'system') {
      return response.status(400).json({ message: 'Default folders cannot be deleted.' });
    }

    const itemCount = await Media.countDocuments({ folder: folder.id });
    if (itemCount > 0) {
      return response.status(409).json({ message: 'Move or delete this folder’s files before deleting it.' });
    }

    await folder.deleteOne();
    return response.status(204).send();
  } catch (error) {
    return next(error);
  }
}
