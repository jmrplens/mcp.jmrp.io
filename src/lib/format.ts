/**
 * Formateo de las magnitudes que enseña el inspector.
 *
 * En un módulo aparte para que la línea de estado pueda vivir fuera del
 * componente sin arrastrarlo entero.
 */

/**
 * Duración legible: milisegundos por debajo del segundo, segundos por encima.
 *
 * @param ms Duración en milisegundos.
 * @returns La duración con su unidad.
 */
export function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

/**
 * Tamaño legible del cuerpo de la respuesta.
 *
 * @param bytes Tamaño en bytes.
 * @returns El tamaño con su unidad.
 */
export function formatBytes(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} kB`;
}
