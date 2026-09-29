const VERTEX = `
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`

// The source is stacked: colour (already premultiplied by the matte) on top, luma matte below,
// so it can go straight to a premultiplied-alpha canvas.
const FRAGMENT = `
precision mediump float;
varying vec2 vUv;
uniform sampler2D uTex;
void main() {
  float y = 1.0 - vUv.y;
  vec3 rgb = texture2D(uTex, vec2(vUv.x, y * 0.5)).rgb;
  float a = texture2D(uTex, vec2(vUv.x, 0.5 + y * 0.5)).r;
  gl_FragColor = vec4(rgb, a);
}`

function compile(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  return gl.getShaderParameter(shader, gl.COMPILE_STATUS) ? shader : null
}

export type MatteRenderer = {
  /**
   * Uploads the video's current frame if it changed and composites it onto the canvas.
   * Returns false while the video has no frame yet, in which case the canvas keeps the previous one.
   */
  draw(video: HTMLVideoElement): boolean
  clear(): void
  dispose(): void
}

/**
 * Renders a stacked-matte video (colour on top, luma matte below) onto a transparent WebGL
 * canvas. The canvas is resized to the colour half of whichever video is drawn.
 */
export function createMatteRenderer(canvas: HTMLCanvasElement): MatteRenderer | null {
  const gl = canvas.getContext("webgl", { alpha: true, premultipliedAlpha: true, antialias: false })
  if (!gl) return null

  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX)
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT)
  const program = gl.createProgram()
  if (!vertex || !fragment || !program) return null
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  gl.useProgram(program)

  const quad = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, "aPos")
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.clearColor(0, 0, 0, 0)

  let lastVideo: HTMLVideoElement | null = null
  let lastTime = -1

  return {
    draw(video) {
      if (video.readyState < 2) return false
      if (video === lastVideo && video.currentTime === lastTime) return true
      lastVideo = video
      lastTime = video.currentTime
      if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight / 2) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight / 2
        gl.viewport(0, 0, canvas.width, canvas.height)
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      return true
    },
    clear() {
      lastVideo = null
      lastTime = -1
      gl.clear(gl.COLOR_BUFFER_BIT)
    },
    dispose() {
      gl.getExtension("WEBGL_lose_context")?.loseContext()
    },
  }
}
