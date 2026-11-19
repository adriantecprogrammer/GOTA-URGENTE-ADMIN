export default defineAppConfig({
  ui: {
    colors: { primary: 'gota', info: 'gota', neutral: 'neutral' },
    button: {
      slots: { base: 'font-semibold' },
      variants: { size: { xl: { base: 'min-h-14 text-[17px]' } } },
      // Solid primary = the one main action per screen: cyan, drop-shaped, in the display face.
      compoundVariants: [{
        color: 'primary',
        variant: 'solid',
        class: 'display rounded-(--radius-cta) bg-gota-300 font-bold text-gota-950 hover:bg-gota-300/80 active:bg-gota-400 disabled:bg-gota-300 aria-disabled:bg-gota-300 focus-visible:outline-gota-950'
      }]
    }
  }
})
