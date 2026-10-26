// Até 3,2 milhões de pixels; a resolução é recalculada ao redimensionar o palco.
export function studioPixelRatio(width, height, deviceRatio = 1) {
  const area = Math.max(1, width * height);
  return Math.min(2, Math.max(1.5, deviceRatio), Math.sqrt(3_200_000 / area));
}

export const CONTACT = Object.freeze({
  exterior: { radius: .85, thickness: 1.6, strength: .48 },
  interior: { radius: .22, thickness: .35, strength: .58 },
});
