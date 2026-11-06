import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    folder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Folder',
      default: null,
      index: true,
    },

    fileName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    objectKey: {
      type: String,
      required: true,
      unique: true,
    },

    
    contentType: {
      type: String,
      required: true,
    },
    
    thumbnailObjectKey: {
      type: String,
      default: null,
    },

    thumbnailContentType: {
      type: String,
      default: null,
    },

    thumbnailSize: {
      type: Number,
      default: null,
      min: 0,
    },

    size: {
      type: Number,
      required: true,
      min: 0,
    },

    status: {
      type: String,
      enum: ['pending', 'ready', 'failed', 'uploaded'],
      default: 'pending',
      index: true,
    },

    width: {
      type: Number,
      min: 0,
    },

    height: {
      type: Number,
      min: 0,
    },

    isFavorite: {
      type: Boolean,
      default: false,
      index: true,
    },
    
    isPrivate: {
      type: Boolean,
      default: false,
      index: true,
    },

    deletedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  { timestamps: true },
);

mediaSchema.index({
  owner: 1,
  folder: 1,
  createdAt: -1,
});

export const Media = mongoose.model('Media', mediaSchema);