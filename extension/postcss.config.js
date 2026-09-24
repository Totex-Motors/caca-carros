// rem depende do font-size do <html> do portal; dentro do Shadow DOM convertemos para px (1rem = 16px)
// para o painel ter sempre o mesmo tamanho, em qualquer site.
const remParaPx = () => ({
  postcssPlugin: 'rem-para-px',
  Declaration(decl) {
    if (decl.value.includes('rem')) {
      decl.value = decl.value.replace(/(-?\d*\.?\d+)rem\b/g, (_, n) => `${parseFloat(n) * 16}px`);
    }
  }
});
remParaPx.postcss = true;

export default { plugins: [(await import('tailwindcss')).default, (await import('autoprefixer')).default, remParaPx] };
