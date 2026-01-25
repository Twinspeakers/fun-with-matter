// Simple avatar catalog (add more later)

export const avatars = [
  {
    id: "jackson",
    label: "Jackson",
    src: "./assets/ui/avatars/jackson.jpg",
    // Cropped headshot; keep centered
    focus: "50% 50%"
  },
  {
    id: "colt",
    label: "Colt",
    src: "./assets/ui/avatars/colt.jpg",
    focus: "50% 50%"
  }
];

export function avatarById(id){
  return avatars.find(a => a.id === id) ?? avatars[0];
}
