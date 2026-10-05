// The one AudioContext the game shares (chime, combat effects, music). Made on first use, which is after a gesture: a chime or a fight needs a click or a key first.
let c; export const audio = () => c ??= new (window.AudioContext || window.webkitAudioContext)();
