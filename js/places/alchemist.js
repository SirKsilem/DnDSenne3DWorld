// Placeholder, replaced by the real place.
export default {
  build(kit, place) {
    console.info('DIM alchemist', place.w, place.d);
    kit.room({ w: Math.min(place.w, 14), d: Math.min(place.d, 12), h: 5, doors: { front: [{ at: 0 }] } });
    kit.info({ id: place.id, name: place.name, kind: place.kind, description: place.description, radius: 12, labelHeight: 10 });
  },
};
