/**
 * Fluid simulation adapted from the user-supplied Lightswind SmokeyCursor source.
 * The unused React wrapper was removed during cleanup. This adapter scopes its shaders and
 * solver to a footer canvas; the caller owns input, rendering and teardown.
 */
interface ColorRGB {
  r: number;
  g: number;
  b: number;
}

interface Pointer {
  id: number;
  texcoordX: number;
  texcoordY: number;
  prevTexcoordX: number;
  prevTexcoordY: number;
  deltaX: number;
  deltaY: number;
  down: boolean;
  moved: boolean;
  color: ColorRGB;
}

function pointerPrototype(): Pointer {
  return {
    id: -1,
    texcoordX: 0,
    texcoordY: 0,
    prevTexcoordX: 0,
    prevTexcoordY: 0,
    deltaX: 0,
    deltaY: 0,
    down: false,
    moved: false,
    color: { r: 0, g: 0, b: 0 },
  };
}

export function createFooterFluid(canvas: HTMLCanvasElement) {
  const resources: Record<string, Set<any>> = {};
  function track<T>(kind: string, resource: T): T {
    if (resource) (resources[kind] ||= new Set()).add(resource);
    return resource;
  }
  function release(kind: string, resource: any, context: any) {
    if (resource && resources[kind]?.delete(resource)) context[`delete${kind}`](resource);
  }
    // Pointer and config setup
    let pointers: Pointer[] = [pointerPrototype()];

    // All these are guaranteed numbers due to destructuring defaults
    // So we cast them to remove TS warnings:
    let config = {
      SIM_RESOLUTION: 128,
      DYE_RESOLUTION: 512,
      CAPTURE_RESOLUTION: 256,
      DENSITY_DISSIPATION: 2.3,
      VELOCITY_DISSIPATION: 1.4,
      PRESSURE: 0.65,
      PRESSURE_ITERATIONS: 20,
      CURL: 14,
      SPLAT_RADIUS: 0.18,
      SPLAT_FORCE: 4200,
      SHADING: true,
      COLOR_UPDATE_SPEED: 0.25,
      PAUSED: false,
      BACK_COLOR: { r: 0, g: 0, b: 0 },
      TRANSPARENT: true,
    };

    // Get WebGL context (WebGL1 or WebGL2)
    const { gl, ext } = getWebGLContext(canvas);
    if (!gl || !ext || !ext.formatRGBA || !ext.formatRG || !ext.formatR) {
      throw new Error("Floating-point render targets are unavailable.");
    }

    // If no linear filtering, reduce resolution
    if (!ext.supportLinearFiltering) {
      config.DYE_RESOLUTION = 256;
      config.SHADING = false;
    }

    function getWebGLContext(canvas: HTMLCanvasElement) {
      const params = {
        alpha: true,
        depth: false,
        stencil: false,
        antialias: false,
        preserveDrawingBuffer: false,
      };

      let gl = canvas.getContext(
        "webgl2",
        params
      ) as WebGL2RenderingContext | null;

      if (!gl) {
        gl = (canvas.getContext("webgl", params) ||
          canvas.getContext(
            "experimental-webgl",
            params
          )) as WebGL2RenderingContext | null;
      }

      if (!gl) {
        throw new Error("Unable to initialize WebGL.");
      }

      const isWebGL2 = "drawBuffers" in gl;

      let supportLinearFiltering = false;
      let halfFloat: OES_texture_half_float | null = null;

      if (isWebGL2) {
        (gl as WebGL2RenderingContext).getExtension("EXT_color_buffer_float");
        supportLinearFiltering = !!(gl as WebGL2RenderingContext).getExtension(
          "OES_texture_float_linear"
        );
      } else {
        halfFloat = gl.getExtension("OES_texture_half_float");
        supportLinearFiltering = !!gl.getExtension(
          "OES_texture_half_float_linear"
        );
      }

      gl.clearColor(0, 0, 0, 0);

      const halfFloatTexType = isWebGL2
        ? (gl as WebGL2RenderingContext).HALF_FLOAT
        : (halfFloat && (halfFloat as any).HALF_FLOAT_OES) || 0;

      let formatRGBA: any;
      let formatRG: any;
      let formatR: any;

      if (isWebGL2) {
        formatRGBA = getSupportedFormat(
          gl,
          (gl as WebGL2RenderingContext).RGBA16F,
          gl.RGBA,
          halfFloatTexType
        );
        formatRG = getSupportedFormat(
          gl,
          (gl as WebGL2RenderingContext).RG16F,
          (gl as WebGL2RenderingContext).RG,
          halfFloatTexType
        );
        formatR = getSupportedFormat(
          gl,
          (gl as WebGL2RenderingContext).R16F,
          (gl as WebGL2RenderingContext).RED,
          halfFloatTexType
        );
      } else {
        formatRGBA = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatRG = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
        formatR = getSupportedFormat(gl, gl.RGBA, gl.RGBA, halfFloatTexType);
      }

      return {
        gl,
        ext: {
          formatRGBA,
          formatRG,
          formatR,
          halfFloatTexType,
          supportLinearFiltering,
        },
      };
    }

    function getSupportedFormat(
      gl: WebGLRenderingContext | WebGL2RenderingContext,
      internalFormat: number,
      format: number,
      type: number
    ): { internalFormat: number; format: number } | null {
      if (!supportRenderTextureFormat(gl, internalFormat, format, type)) {
        // For WebGL2 fallback:
        if ("drawBuffers" in gl) {
          const gl2 = gl as WebGL2RenderingContext;
          switch (internalFormat) {
            case gl2.R16F:
              return getSupportedFormat(gl2, gl2.RG16F, gl2.RG, type);
            case gl2.RG16F:
              return getSupportedFormat(gl2, gl2.RGBA16F, gl2.RGBA, type);
            default:
              return null;
          }
        }
        return null;
      }
      return { internalFormat, format };
    }

    function supportRenderTextureFormat(
      gl: WebGLRenderingContext | WebGL2RenderingContext,
      internalFormat: number,
      format: number,
      type: number
    ) {
      const texture = track("Texture", gl.createTexture());
      if (!texture) return false;

      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        4,
        4,
        0,
        format,
        type,
        null
      );

      const fbo = track("Framebuffer", gl.createFramebuffer());
      if (!fbo) return false;

      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
      release("Framebuffer", fbo, gl); release("Texture", texture, gl);
      return status === gl.FRAMEBUFFER_COMPLETE;
    }

    function hashCode(s: string) {
      if (!s.length) return 0;
      let hash = 0;
      for (let i = 0; i < s.length; i++) {
        hash = (hash << 5) - hash + s.charCodeAt(i);
        hash |= 0;
      }
      return hash;
    }

    function addKeywords(source: string, keywords: string[] | null) {
      if (!keywords) return source;
      let keywordsString = "";
      for (const keyword of keywords) {
        keywordsString += `#define ${keyword}\n`;
      }
      return keywordsString + source;
    }

    function compileShader(
      type: number,
      source: string,
      keywords: string[] | null = null
    ): WebGLShader | null {
      const shaderSource = addKeywords(source, keywords);
      const shader = track("Shader", gl.createShader(type));
      if (!shader) return null;
      gl.shaderSource(shader, shaderSource);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.trace(gl.getShaderInfoLog(shader));
      }
      return shader;
    }

    function createProgram(
      vertexShader: WebGLShader | null,
      fragmentShader: WebGLShader | null
    ): WebGLProgram | null {
      if (!vertexShader || !fragmentShader) return null;
      const program = track("Program", gl.createProgram());
      if (!program) return null;
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.trace(gl.getProgramInfoLog(program));
      }
      return program;
    }

    function getUniforms(program: WebGLProgram) {
      let uniforms: Record<string, WebGLUniformLocation | null> = {};
      const uniformCount = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
      for (let i = 0; i < uniformCount; i++) {
        const uniformInfo = gl.getActiveUniform(program, i);
        if (uniformInfo) {
          uniforms[uniformInfo.name] = gl.getUniformLocation(
            program,
            uniformInfo.name
          );
        }
      }
      return uniforms;
    }

    class Program {
      program: WebGLProgram | null;
      uniforms: Record<string, WebGLUniformLocation | null>;

      constructor(
        vertexShader: WebGLShader | null,
        fragmentShader: WebGLShader | null
      ) {
        this.program = createProgram(vertexShader, fragmentShader);
        this.uniforms = this.program ? getUniforms(this.program) : {};
      }

      bind() {
        if (this.program) gl.useProgram(this.program);
      }
    }

    class Material {
      vertexShader: WebGLShader | null;
      fragmentShaderSource: string;
      programs: Record<number, WebGLProgram | null>;
      activeProgram: WebGLProgram | null;
      uniforms: Record<string, WebGLUniformLocation | null>;

      constructor(
        vertexShader: WebGLShader | null,
        fragmentShaderSource: string
      ) {
        this.vertexShader = vertexShader;
        this.fragmentShaderSource = fragmentShaderSource;
        this.programs = {};
        this.activeProgram = null;
        this.uniforms = {};
      }

      setKeywords(keywords: string[]) {
        let hash = 0;
        for (const kw of keywords) {
          hash += hashCode(kw);
        }
        let program = this.programs[hash];
        if (program == null) {
          const fragmentShader = compileShader(
            gl.FRAGMENT_SHADER,
            this.fragmentShaderSource,
            keywords
          );
          program = createProgram(this.vertexShader, fragmentShader);
          this.programs[hash] = program;
        }
        if (program === this.activeProgram) return;
        if (program) {
          this.uniforms = getUniforms(program);
        }
        this.activeProgram = program;
      }

      bind() {
        if (this.activeProgram) {
          gl.useProgram(this.activeProgram);
        }
      }
    }

    // -------------------- Shaders --------------------
    const baseVertexShader = compileShader(
      gl.VERTEX_SHADER,
      `
      precision highp float;
      attribute vec2 aPosition;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform vec2 texelSize;

      void main () {
        vUv = aPosition * 0.5 + 0.5;
        vL = vUv - vec2(texelSize.x, 0.0);
        vR = vUv + vec2(texelSize.x, 0.0);
        vT = vUv + vec2(0.0, texelSize.y);
        vB = vUv - vec2(0.0, texelSize.y);
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `
    );

    const copyShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;

      void main () {
          gl_FragColor = texture2D(uTexture, vUv);
      }
    `
    );

    const clearShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      uniform sampler2D uTexture;
      uniform float value;

      void main () {
          gl_FragColor = value * texture2D(uTexture, vUv);
      }
    `
    );

    const displayShaderSource = `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uTexture;
      uniform vec2 texelSize;

      void main () {
          vec3 c = texture2D(uTexture, vUv).rgb;
          float density = max(c.r, max(c.g, c.b));
          float coverage = smoothstep(0.003, 0.035, density) * (1.0 - exp(-density * 5.0));
          vec3 silver = vec3(0.48, 0.49, 0.46);
          #ifdef SHADING
              vec3 lc = texture2D(uTexture, vL).rgb;
              vec3 rc = texture2D(uTexture, vR).rgb;
              vec3 tc = texture2D(uTexture, vT).rgb;
              vec3 bc = texture2D(uTexture, vB).rgb;

              float dx = length(rc) - length(lc);
              float dy = length(tc) - length(bc);

              vec3 n = normalize(vec3(-dx * 2.5, -dy * 2.5, 0.035));
              float rim = pow(1.0 - max(n.z, 0.0), 1.7);
              float light = pow(max(dot(n, normalize(vec3(-0.35, 0.6, 0.9))), 0.0), 18.0);
              // Neutral silver body with restrained thin-film color on the folds.
              vec3 pearl = 0.5 + 0.5 * cos(5.5 * n.y + 3.0 * n.x + density * 2.0 + vec3(0.0, 2.094, 4.188));
              silver = vec3(0.12) + vec3(0.56) * light + vec3(0.44) * rim;
              silver *= mix(vec3(1.0), 0.65 + pearl * 0.55, 0.28);
          #endif
          gl_FragColor = vec4(silver * coverage, coverage);
      }
    `;

    const splatShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uTarget;
      uniform float aspectRatio;
      uniform vec3 color;
      uniform vec2 point;
      uniform float radius;

      void main () {
          vec2 p = vUv - point.xy;
          p.x *= aspectRatio;
          vec3 splat = exp(-dot(p, p) / radius) * color;
          vec3 base = texture2D(uTarget, vUv).xyz;
          gl_FragColor = vec4(base + splat, 1.0);
      }
    `
    );

    const advectionShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      uniform sampler2D uVelocity;
      uniform sampler2D uSource;
      uniform vec2 texelSize;
      uniform vec2 dyeTexelSize;
      uniform float dt;
      uniform float dissipation;

      vec4 bilerp (sampler2D sam, vec2 uv, vec2 tsize) {
          vec2 st = uv / tsize - 0.5;
          vec2 iuv = floor(st);
          vec2 fuv = fract(st);

          vec4 a = texture2D(sam, (iuv + vec2(0.5, 0.5)) * tsize);
          vec4 b = texture2D(sam, (iuv + vec2(1.5, 0.5)) * tsize);
          vec4 c = texture2D(sam, (iuv + vec2(0.5, 1.5)) * tsize);
          vec4 d = texture2D(sam, (iuv + vec2(1.5, 1.5)) * tsize);

          return mix(mix(a, b, fuv.x), mix(c, d, fuv.x), fuv.y);
      }

      void main () {
          #ifdef MANUAL_FILTERING
              vec2 coord = vUv - dt * bilerp(uVelocity, vUv, texelSize).xy * texelSize;
              vec4 result = bilerp(uSource, coord, dyeTexelSize);
          #else
              vec2 coord = vUv - dt * texture2D(uVelocity, vUv).xy * texelSize;
              vec4 result = texture2D(uSource, coord);
          #endif
          float decay = 1.0 + dissipation * dt;
          gl_FragColor = result / decay;
      }
    `,
      ext.supportLinearFiltering ? null : ["MANUAL_FILTERING"]
    );

    const divergenceShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uVelocity, vL).x;
          float R = texture2D(uVelocity, vR).x;
          float T = texture2D(uVelocity, vT).y;
          float B = texture2D(uVelocity, vB).y;

          vec2 C = texture2D(uVelocity, vUv).xy;
          if (vL.x < 0.0) { L = -C.x; }
          if (vR.x > 1.0) { R = -C.x; }
          if (vT.y > 1.0) { T = -C.y; }
          if (vB.y < 0.0) { B = -C.y; }

          float div = 0.5 * (R - L + T - B);
          gl_FragColor = vec4(div, 0.0, 0.0, 1.0);
      }
    `
    );

    const curlShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uVelocity, vL).y;
          float R = texture2D(uVelocity, vR).y;
          float T = texture2D(uVelocity, vT).x;
          float B = texture2D(uVelocity, vB).x;
          float vorticity = R - L - T + B;
          gl_FragColor = vec4(0.5 * vorticity, 0.0, 0.0, 1.0);
      }
    `
    );

    const vorticityShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision highp float;
      precision highp sampler2D;
      varying vec2 vUv;
      varying vec2 vL;
      varying vec2 vR;
      varying vec2 vT;
      varying vec2 vB;
      uniform sampler2D uVelocity;
      uniform sampler2D uCurl;
      uniform float curl;
      uniform float dt;

      void main () {
          float L = texture2D(uCurl, vL).x;
          float R = texture2D(uCurl, vR).x;
          float T = texture2D(uCurl, vT).x;
          float B = texture2D(uCurl, vB).x;
          float C = texture2D(uCurl, vUv).x;

          vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
          force /= length(force) + 0.0001;
          force *= curl * C;
          force.y *= -1.0;

          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity += force * dt;
          velocity = min(max(velocity, -1000.0), 1000.0);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `
    );

    const pressureShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uDivergence;

      void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          float C = texture2D(uPressure, vUv).x;
          float divergence = texture2D(uDivergence, vUv).x;
          float pressure = (L + R + B + T - divergence) * 0.25;
          gl_FragColor = vec4(pressure, 0.0, 0.0, 1.0);
      }
    `
    );

    const gradientSubtractShader = compileShader(
      gl.FRAGMENT_SHADER,
      `
      precision mediump float;
      precision mediump sampler2D;
      varying highp vec2 vUv;
      varying highp vec2 vL;
      varying highp vec2 vR;
      varying highp vec2 vT;
      varying highp vec2 vB;
      uniform sampler2D uPressure;
      uniform sampler2D uVelocity;

      void main () {
          float L = texture2D(uPressure, vL).x;
          float R = texture2D(uPressure, vR).x;
          float T = texture2D(uPressure, vT).x;
          float B = texture2D(uPressure, vB).x;
          vec2 velocity = texture2D(uVelocity, vUv).xy;
          velocity.xy -= vec2(R - L, T - B);
          gl_FragColor = vec4(velocity, 0.0, 1.0);
      }
    `
    );

    // -------------------- Fullscreen Triangles --------------------
    const blit = (() => {
      const buffer = track("Buffer", gl.createBuffer())!;
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        new Float32Array([-1, -1, -1, 1, 1, 1, 1, -1]),
        gl.STATIC_DRAW
      );
      const elemBuffer = track("Buffer", gl.createBuffer())!;
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elemBuffer);
      gl.bufferData(
        gl.ELEMENT_ARRAY_BUFFER,
        new Uint16Array([0, 1, 2, 0, 2, 3]),
        gl.STATIC_DRAW
      );
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(0);

      return (target: FBO | null, doClear = false) => {
        if (!gl) return;
        if (!target) {
          gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
          gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        } else {
          gl.viewport(0, 0, target.width, target.height);
          gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        }
        if (doClear) {
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);
        }
        gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      };
    })();

    // Types for Framebuffers
    interface FBO {
      texture: WebGLTexture;
      fbo: WebGLFramebuffer;
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
      attach: (id: number) => number;
    }

    interface DoubleFBO {
      width: number;
      height: number;
      texelSizeX: number;
      texelSizeY: number;
      read: FBO;
      write: FBO;
      swap: () => void;
    }

    // FBO variables
    let dye: DoubleFBO;
    let velocity: DoubleFBO;
    let divergence: FBO;
    let curlFBO: FBO;
    let pressureFBO: DoubleFBO;

    // WebGL Programs
    const copyProgram = new Program(baseVertexShader, copyShader);
    const clearProgram = new Program(baseVertexShader, clearShader);
    const splatProgram = new Program(baseVertexShader, splatShader);
    const advectionProgram = new Program(baseVertexShader, advectionShader);
    const divergenceProgram = new Program(baseVertexShader, divergenceShader);
    const curlProgram = new Program(baseVertexShader, curlShader);
    const vorticityProgram = new Program(baseVertexShader, vorticityShader);
    const pressureProgram = new Program(baseVertexShader, pressureShader);
    const gradienSubtractProgram = new Program(
      baseVertexShader,
      gradientSubtractShader
    );
    const displayMaterial = new Material(baseVertexShader, displayShaderSource);

    // -------------------- FBO creation --------------------
    function createFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ): FBO {
      gl.activeTexture(gl.TEXTURE0);
      const texture = track("Texture", gl.createTexture())!;
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, param);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null
      );
      const fbo = track("Framebuffer", gl.createFramebuffer())!;
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0,
        gl.TEXTURE_2D,
        texture,
        0
      );
      gl.viewport(0, 0, w, h);
      gl.clear(gl.COLOR_BUFFER_BIT);

      const texelSizeX = 1 / w;
      const texelSizeY = 1 / h;

      return {
        texture,
        fbo,
        width: w,
        height: h,
        texelSizeX,
        texelSizeY,
        attach(id: number) {
          gl.activeTexture(gl.TEXTURE0 + id);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          return id;
        },
      };
    }

    function createDoubleFBO(
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ): DoubleFBO {
      const fbo1 = createFBO(w, h, internalFormat, format, type, param);
      const fbo2 = createFBO(w, h, internalFormat, format, type, param);
      return {
        width: w,
        height: h,
        texelSizeX: fbo1.texelSizeX,
        texelSizeY: fbo1.texelSizeY,
        read: fbo1,
        write: fbo2,
        swap() {
          const tmp = this.read;
          this.read = this.write;
          this.write = tmp;
        },
      };
    }

    function resizeFBO(
      target: FBO,
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      const newFBO = createFBO(w, h, internalFormat, format, type, param);
      copyProgram.bind();
      if (copyProgram.uniforms.uTexture)
        gl.uniform1i(copyProgram.uniforms.uTexture, target.attach(0));
      blit(newFBO, false);
      return newFBO;
    }

    function resizeDoubleFBO(
      target: DoubleFBO,
      w: number,
      h: number,
      internalFormat: number,
      format: number,
      type: number,
      param: number
    ) {
      if (target.width === w && target.height === h) return target;
      target.read = resizeFBO(
        target.read,
        w,
        h,
        internalFormat,
        format,
        type,
        param
      );
      target.write = createFBO(w, h, internalFormat, format, type, param);
      target.width = w;
      target.height = h;
      target.texelSizeX = 1 / w;
      target.texelSizeY = 1 / h;
      return target;
    }

    function destroyFBO(target?: FBO) {
      if (!target) return;
      release("Texture", target.texture, gl); release("Framebuffer", target.fbo, gl);
    }
    function initFramebuffers() {
      // Resizing starts a fresh field and releases superseded textures.
      if (dye) { destroyFBO(dye.read); destroyFBO(dye.write); }
      if (velocity) { destroyFBO(velocity.read); destroyFBO(velocity.write); }
      destroyFBO(divergence); destroyFBO(curlFBO);
      if (pressureFBO) { destroyFBO(pressureFBO.read); destroyFBO(pressureFBO.write); }
      dye = null!; velocity = null!;

      const simRes = getResolution(config.SIM_RESOLUTION!);
      const dyeRes = getResolution(config.DYE_RESOLUTION!);

      const texType = ext.halfFloatTexType;
      const rgba = ext.formatRGBA;
      const rg = ext.formatRG;
      const r = ext.formatR;
      const filtering = ext.supportLinearFiltering ? gl.LINEAR : gl.NEAREST;
      gl.disable(gl.BLEND);

      if (!dye) {
        dye = createDoubleFBO(
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering
        );
      } else {
        dye = resizeDoubleFBO(
          dye,
          dyeRes.width,
          dyeRes.height,
          rgba.internalFormat,
          rgba.format,
          texType,
          filtering
        );
      }

      if (!velocity) {
        velocity = createDoubleFBO(
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering
        );
      } else {
        velocity = resizeDoubleFBO(
          velocity,
          simRes.width,
          simRes.height,
          rg.internalFormat,
          rg.format,
          texType,
          filtering
        );
      }

      divergence = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
      curlFBO = createFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
      pressureFBO = createDoubleFBO(
        simRes.width,
        simRes.height,
        r.internalFormat,
        r.format,
        texType,
        gl.NEAREST
      );
    }

    function updateKeywords() {
      const displayKeywords: string[] = [];
      if (config.SHADING) displayKeywords.push("SHADING");
      displayMaterial.setKeywords(displayKeywords);
    }

    function getResolution(resolution: number) {
      const w = gl.drawingBufferWidth;
      const h = gl.drawingBufferHeight;
      const aspectRatio = w / h;
      let aspect = aspectRatio < 1 ? 1 / aspectRatio : aspectRatio;
      const min = Math.round(resolution);
      const max = Math.round(resolution * aspect);
      if (w > h) {
        return { width: max, height: min };
      }
      return { width: min, height: max };
    }

    function scaleByPixelRatio(input: number) {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      return Math.floor(input * pixelRatio);
    }

    // -------------------- Simulation Setup --------------------
    resizeCanvas();
    updateKeywords();
    initFramebuffers();

    let colorUpdateTimer = 0.0;

    function resizeCanvas() {
      const width = scaleByPixelRatio(canvas!.clientWidth);
      const height = scaleByPixelRatio(canvas!.clientHeight);
      if (canvas!.width !== width || canvas!.height !== height) {
        canvas!.width = width;
        canvas!.height = height;
        return true;
      }
      return false;
    }

    function updateColors(dt: number) {
      colorUpdateTimer += dt * config.COLOR_UPDATE_SPEED;
      if (colorUpdateTimer >= 1) {
        colorUpdateTimer = wrap(colorUpdateTimer, 0, 1);
        pointers.forEach((p) => {
          p.color = generateColor();
        });
      }
    }

    function applyInputs() {
      for (const p of pointers) {
        if (p.moved) {
          p.moved = false;
          splatPointer(p);
          p.deltaX = p.deltaY = 0;
        }
      }
    }

    function step(dt: number) {
      gl.disable(gl.BLEND);

      // Curl
      curlProgram.bind();
      if (curlProgram.uniforms.texelSize) {
        gl.uniform2f(
          curlProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (curlProgram.uniforms.uVelocity) {
        gl.uniform1i(curlProgram.uniforms.uVelocity, velocity.read.attach(0));
      }
      blit(curlFBO);

      // Vorticity
      vorticityProgram.bind();
      if (vorticityProgram.uniforms.texelSize) {
        gl.uniform2f(
          vorticityProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (vorticityProgram.uniforms.uVelocity) {
        gl.uniform1i(
          vorticityProgram.uniforms.uVelocity,
          velocity.read.attach(0)
        );
      }
      if (vorticityProgram.uniforms.uCurl) {
        gl.uniform1i(vorticityProgram.uniforms.uCurl, curlFBO.attach(1));
      }
      if (vorticityProgram.uniforms.curl) {
        gl.uniform1f(vorticityProgram.uniforms.curl, config.CURL);
      }
      if (vorticityProgram.uniforms.dt) {
        gl.uniform1f(vorticityProgram.uniforms.dt, dt);
      }
      blit(velocity.write);
      velocity.swap();

      // Divergence
      divergenceProgram.bind();
      if (divergenceProgram.uniforms.texelSize) {
        gl.uniform2f(
          divergenceProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (divergenceProgram.uniforms.uVelocity) {
        gl.uniform1i(
          divergenceProgram.uniforms.uVelocity,
          velocity.read.attach(0)
        );
      }
      blit(divergence);

      // Clear pressure
      clearProgram.bind();
      if (clearProgram.uniforms.uTexture) {
        gl.uniform1i(
          clearProgram.uniforms.uTexture,
          pressureFBO.read.attach(0)
        );
      }
      if (clearProgram.uniforms.value) {
        gl.uniform1f(clearProgram.uniforms.value, config.PRESSURE);
      }
      blit(pressureFBO.write);
      pressureFBO.swap();

      // Pressure
      pressureProgram.bind();
      if (pressureProgram.uniforms.texelSize) {
        gl.uniform2f(
          pressureProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (pressureProgram.uniforms.uDivergence) {
        gl.uniform1i(
          pressureProgram.uniforms.uDivergence,
          divergence.attach(0)
        );
      }
      for (let i = 0; i < config.PRESSURE_ITERATIONS; i++) {
        if (pressureProgram.uniforms.uPressure) {
          gl.uniform1i(
            pressureProgram.uniforms.uPressure,
            pressureFBO.read.attach(1)
          );
        }
        blit(pressureFBO.write);
        pressureFBO.swap();
      }

      // Gradient Subtract
      gradienSubtractProgram.bind();
      if (gradienSubtractProgram.uniforms.texelSize) {
        gl.uniform2f(
          gradienSubtractProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (gradienSubtractProgram.uniforms.uPressure) {
        gl.uniform1i(
          gradienSubtractProgram.uniforms.uPressure,
          pressureFBO.read.attach(0)
        );
      }
      if (gradienSubtractProgram.uniforms.uVelocity) {
        gl.uniform1i(
          gradienSubtractProgram.uniforms.uVelocity,
          velocity.read.attach(1)
        );
      }
      blit(velocity.write);
      velocity.swap();

      // Advection - velocity
      advectionProgram.bind();
      if (advectionProgram.uniforms.texelSize) {
        gl.uniform2f(
          advectionProgram.uniforms.texelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      if (
        !ext.supportLinearFiltering &&
        advectionProgram.uniforms.dyeTexelSize
      ) {
        gl.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          velocity.texelSizeX,
          velocity.texelSizeY
        );
      }
      const velocityId = velocity.read.attach(0);
      if (advectionProgram.uniforms.uVelocity) {
        gl.uniform1i(advectionProgram.uniforms.uVelocity, velocityId);
      }
      if (advectionProgram.uniforms.uSource) {
        gl.uniform1i(advectionProgram.uniforms.uSource, velocityId);
      }
      if (advectionProgram.uniforms.dt) {
        gl.uniform1f(advectionProgram.uniforms.dt, dt);
      }
      if (advectionProgram.uniforms.dissipation) {
        gl.uniform1f(
          advectionProgram.uniforms.dissipation,
          config.VELOCITY_DISSIPATION
        );
      }
      blit(velocity.write);
      velocity.swap();

      // Advection - dye
      if (
        !ext.supportLinearFiltering &&
        advectionProgram.uniforms.dyeTexelSize
      ) {
        gl.uniform2f(
          advectionProgram.uniforms.dyeTexelSize,
          dye.texelSizeX,
          dye.texelSizeY
        );
      }
      if (advectionProgram.uniforms.uVelocity) {
        gl.uniform1i(
          advectionProgram.uniforms.uVelocity,
          velocity.read.attach(0)
        );
      }
      if (advectionProgram.uniforms.uSource) {
        gl.uniform1i(advectionProgram.uniforms.uSource, dye.read.attach(1));
      }
      if (advectionProgram.uniforms.dissipation) {
        gl.uniform1f(
          advectionProgram.uniforms.dissipation,
          config.DENSITY_DISSIPATION
        );
      }
      blit(dye.write);
      dye.swap();
    }

    function render(target: FBO | null) {
      // The full-screen pass writes premultiplied alpha, including empty pixels.
      gl.disable(gl.BLEND);
      drawDisplay(target);
    }

    function drawDisplay(target: FBO | null) {
      displayMaterial.bind();
      if (config.SHADING && displayMaterial.uniforms.texelSize) {
        gl.uniform2f(displayMaterial.uniforms.texelSize, dye.texelSizeX, dye.texelSizeY);
      }
      if (displayMaterial.uniforms.uTexture) {
        gl.uniform1i(displayMaterial.uniforms.uTexture, dye.read.attach(0));
      }
      blit(target, false);
    }

    // -------------------- Interaction --------------------
    function splatPointer(pointer: Pointer) {
      const dx = pointer.deltaX * config.SPLAT_FORCE;
      const dy = pointer.deltaY * config.SPLAT_FORCE;
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, pointer.color);
    }

    function clickSplat(pointer: Pointer) {
      const color = generateColor();
      color.r *= 10;
      color.g *= 10;
      color.b *= 10;
      const dx = 10 * (Math.random() - 0.5);
      const dy = 30 * (Math.random() - 0.5);
      splat(pointer.texcoordX, pointer.texcoordY, dx, dy, color);
    }

    function splat(
      x: number,
      y: number,
      dx: number,
      dy: number,
      color: ColorRGB
    ) {
      splatProgram.bind();
      if (splatProgram.uniforms.uTarget) {
        gl.uniform1i(splatProgram.uniforms.uTarget, velocity.read.attach(0));
      }
      if (splatProgram.uniforms.aspectRatio) {
        gl.uniform1f(
          splatProgram.uniforms.aspectRatio,
          canvas!.width / canvas!.height
        );
      }
      if (splatProgram.uniforms.point) {
        gl.uniform2f(splatProgram.uniforms.point, x, y);
      }
      if (splatProgram.uniforms.color) {
        gl.uniform3f(splatProgram.uniforms.color, dx, dy, 0);
      }
      if (splatProgram.uniforms.radius) {
        gl.uniform1f(
          splatProgram.uniforms.radius,
          correctRadius(config.SPLAT_RADIUS / 100)!
        );
      }
      blit(velocity.write);
      velocity.swap();

      if (splatProgram.uniforms.uTarget) {
        gl.uniform1i(splatProgram.uniforms.uTarget, dye.read.attach(0));
      }
      if (splatProgram.uniforms.color) {
        gl.uniform3f(splatProgram.uniforms.color, color.r, color.g, color.b);
      }
      blit(dye.write);
      dye.swap();
    }

    function correctRadius(radius: number) {
      // Use non-null assertion (canvas can't be null here)
      const aspectRatio = canvas!.width / canvas!.height;
      if (aspectRatio > 1) radius *= aspectRatio;
      return radius;
    }

    function updatePointerDownData(
      pointer: Pointer,
      id: number,
      posX: number,
      posY: number
    ) {
      pointer.id = id;
      pointer.down = true;
      pointer.moved = false;
      pointer.texcoordX = posX / canvas!.width;
      pointer.texcoordY = 1 - posY / canvas!.height;
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.deltaX = 0;
      pointer.deltaY = 0;
      pointer.color = generateColor();
    }

    function updatePointerMoveData(
      pointer: Pointer,
      posX: number,
      posY: number,
      color: ColorRGB
    ) {
      pointer.prevTexcoordX = pointer.texcoordX;
      pointer.prevTexcoordY = pointer.texcoordY;
      pointer.texcoordX = posX / canvas!.width;
      pointer.texcoordY = 1 - posY / canvas!.height;
      pointer.deltaX += correctDeltaX(
        pointer.texcoordX - pointer.prevTexcoordX
      )!;
      pointer.deltaY += correctDeltaY(
        pointer.texcoordY - pointer.prevTexcoordY
      )!;
      pointer.moved =
        Math.abs(pointer.deltaX) > 0 || Math.abs(pointer.deltaY) > 0;
      pointer.color = color;
    }

    function updatePointerUpData(pointer: Pointer) {
      pointer.down = false;
    }

    function correctDeltaX(delta: number) {
      const aspectRatio = canvas!.width / canvas!.height;
      if (aspectRatio < 1) delta *= aspectRatio;
      return delta;
    }

    function correctDeltaY(delta: number) {
      const aspectRatio = canvas!.width / canvas!.height;
      if (aspectRatio > 1) delta /= aspectRatio;
      return delta;
    }

    function generateColor(): ColorRGB {
      const c = HSVtoRGB(Math.random(), .08, 1.0);
      c.r *= 0.28;
      c.g *= 0.28;
      c.b *= 0.28;
      return c;
    }

    function HSVtoRGB(h: number, s: number, v: number): ColorRGB {
      let r = 0,
        g = 0,
        b = 0;
      const i = Math.floor(h * 6);
      const f = h * 6 - i;
      const p = v * (1 - s);
      const q = v * (1 - f * s);
      const t = v * (1 - (1 - f) * s);

      switch (i % 6) {
        case 0:
          r = v;
          g = t;
          b = p;
          break;
        case 1:
          r = q;
          g = v;
          b = p;
          break;
        case 2:
          r = p;
          g = v;
          b = t;
          break;
        case 3:
          r = p;
          g = q;
          b = v;
          break;
        case 4:
          r = t;
          g = p;
          b = v;
          break;
        case 5:
          r = v;
          g = p;
          b = q;
          break;
      }
      return { r, g, b };
    }

    function wrap(value: number, min: number, max: number) {
      const range = max - min;
      if (range === 0) return min;
      return ((value - min) % range) + min;
    }


    let disposed = false;
    function clear() {
      if (disposed) return;
      gl.disable(gl.BLEND); gl.clearColor(0, 0, 0, 0);
      for (const target of [dye.read, dye.write, velocity.read, velocity.write, divergence, curlFBO, pressureFBO.read, pressureFBO.write]) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo); gl.clear(gl.COLOR_BUFFER_BIT);
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.clear(gl.COLOR_BUFFER_BIT);
      pointers[0].moved = false; pointers[0].down = false;
    }
    return {
      move(x: number, y: number, first = false) {
        if (disposed) return;
        const pointer = pointers[0];
        if (first || !pointer.down) updatePointerDownData(pointer, -1, x * canvas.width, y * canvas.height);
        else updatePointerMoveData(pointer, x * canvas.width, y * canvas.height, pointer.color);
      },
      render(seconds: number) {
        if (disposed) return;
        const dt = Math.min(Math.max(seconds, .001), .033);
        updateColors(dt); applyInputs(); step(dt); render(null);
      },
      resize() { if (!disposed && resizeCanvas()) { initFramebuffers(); clear(); } },
      clear,
      dispose() {
        if (disposed) return;
        clear(); disposed = true;
        for (const [kind, entries] of Object.entries(resources)) {
          for (const resource of [...entries]) release(kind, resource, gl);
        }
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      },
    };
}
