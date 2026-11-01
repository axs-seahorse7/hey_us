import React, { useEffect, useState } from 'react';
import api from '../services/api';

const Gallery = () => {
  const [images, setImages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchImages = async () => {
      try {
        setIsLoading(true);
        const response = await api.get('/gallery');
        setImages(response.data.media || []);
      } catch (err) {
        console.error('Error fetching gallery images:', err);
        setError('Failed to load images. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchImages();
  }, []);

  const groupImagesByDate = (media) => {
    const groups = {};

    media.forEach((image) => {
      const date = image.createdAt ? new Date(image.createdAt) : new Date();
      const dateString = date.toISOString().split('T')[0];

      if (!groups[dateString]) {
        groups[dateString] = [];
      }
      groups[dateString].push(image);
    });

    // Sort dates in descending order
    return Object.entries(groups)
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, imgs]) => ({
        date,
        images: imgs,
        formattedDate: formatDate(date),
      }));
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const checkDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    if (checkDate.getTime() === today.getTime()) return 'Today';
    if (checkDate.getTime() === yesterday.getTime()) return 'Yesterday';

    return new Intl.DateTimeFormat('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg font-medium text-gray-600 animate-pulse">Loading your memories...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-red-500 bg-red-100 px-4 py-2 rounded-lg">{error}</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
        <div className="text-4xl mb-4">📷</div>
        <h2 className="text-2xl font-semibold text-gray-800">Your gallery is empty</h2>
        <p className="text-gray-500 mt-2">Start uploading your favorite moments together!</p>
      </div>
    );
  }

  const groupedMedia = groupImagesByDate(images);

  return (
    <div className="p-4 md:p-8 pb-24">
      <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">Our Gallery</h1>

      <div className="space-y-8">
        {groupedMedia.map(({ date, images: groupImages, formattedDate }) => (
          <div key={date} className="gallery-group">
            <h2 className="text-sm font-semibold text-gray-500 mb-3 px-1 uppercase tracking-wider">
              {formattedDate}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-[1px] bg-gray-200 border border-gray-200">
              {groupImages.map((image) => (
                <div key={image._id} className="group relative aspect-square overflow-hidden bg-gray-200 transition-all">
                  <img
                    src={image.url}
                    alt={image.fileName}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end p-3">
                    <p className="text-white text-xs truncate font-medium">{image.fileName}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Gallery;
