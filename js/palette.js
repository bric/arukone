window.Arukone = window.Arukone || {};

window.Arukone.Palette = [
  '#e6194b', '#3cb44b', '#4363d8', '#f58231',
  '#911eb4', '#42d4f4', '#f032e6', '#bfef45',
  '#469990', '#9a6324', '#800000', '#808000'
];

window.Arukone.colorForPair = function colorForPair(pairId) {
  var palette = window.Arukone.Palette;
  var index = (pairId - 1) % palette.length;
  return palette[index];
};
