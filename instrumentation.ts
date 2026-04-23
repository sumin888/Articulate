export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = globalThis as any
    if (typeof g.DOMMatrix === 'undefined') {
      g.DOMMatrix = class {
        m11=1;m12=0;m13=0;m14=0
        m21=0;m22=1;m23=0;m24=0
        m31=0;m32=0;m33=1;m34=0
        m41=0;m42=0;m43=0;m44=1
        is2D=true;isIdentity=true
      }
    }
  }
}
