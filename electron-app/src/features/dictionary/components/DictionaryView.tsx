export const DictionaryView = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
    <div className="page-header">
      <h1>Dictionary</h1>
      <button className="btn-primary">Add new</button>
    </div>
    <div className="tabs-row">
      <span className="tab-link active">All</span>
      <span className="tab-link">Personal</span>
      <span className="tab-link">Shared with team</span>
    </div>
    
    <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #78350f, #451a03)' }}>
      <h2>Flow spells the way <em>you</em> do.</h2>
      <p>Flow learns your unique words and names — automatically or manually. <strong>Add personal terms, company jargon, client names, or industry-specific lingo.</strong> Share them with your team so everyone stays on the same page.</p>
      <div className="tag-cloud">
        <span className="tag primary">Add new word</span>
        <span className="tag">Wispr Flow</span>
        <span className="tag">Satheesh</span>
        <span className="tag">Spyder</span>
      </div>
    </div>
    
    <div className="list-table">
      <div className="list-row">Wispr Flow</div>
      <div className="list-row">Satheesh</div>
      <div className="list-row">btw <span className="arrow">→</span> by the way</div>
      <div className="list-row">satheesh.atluri56@gmail.com</div>
      <div className="list-row">Satheesh Atluri</div>
    </div>
  </div>
);
