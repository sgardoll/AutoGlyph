const steps = [
  {
    id: '01',
    title: 'Load a clean source sheet',
    detail: 'Flat page, high contrast, and visible ascenders/descenders give the detector better edges.',
  },
  {
    id: '02',
    title: 'Review every proposed glyph',
    detail: 'Select boxes, correct labels, and remove bad captures before generating the font.',
  },
  {
    id: '03',
    title: 'Export and test fast',
    detail: 'Generate the file, install it locally, then come back for another cleanup pass if spacing feels off.',
  },
];

export function ProcessGuide() {
  return (
    <section className="surface inspector-surface panel-animated panel-delay-3">
      <div className="surface-header">
        <div>
          <p className="surface-kicker">Process</p>
          <h2>Recommended rhythm</h2>
        </div>
      </div>

      <ol className="process-list">
        {steps.map((step) => (
          <li key={step.id}>
            <span>{step.id}</span>
            <div>
              <strong>{step.title}</strong>
              <p>{step.detail}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
