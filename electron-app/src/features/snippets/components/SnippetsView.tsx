export const SnippetsView = () => (
  <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', paddingRight: '20px' }}>
    <div className="page-header">
      <h1>Snippets</h1>
      <button className="btn-primary">Add new</button>
    </div>
    <div className="tabs-row">
      <span className="tab-link active">All</span>
      <span className="tab-link">Personal</span>
      <span className="tab-link">Shared with team</span>
    </div>
    
    <div className="hero-banner" style={{ background: 'linear-gradient(135deg, #064e3b, #022c22)' }}>
      <h2>The stuff <em>you</em> shouldn't have to re-type.</h2>
      <p>Save anything you type often — your email, an intro, a prompt — and say a word or phrase to immediately replace it in place.</p>
      <div className="tag-cloud">
        <span className="tag primary">Add new snippet</span>
        <span className="tag">"my LinkedIn" → https://www.linkedin.com/...</span>
        <span className="tag">"rewrite prompt" → Rewrite this to be more concise...</span>
      </div>
    </div>
    
    <div className="list-table">
      <div className="list-row">my Flow referral <span className="arrow">→</span> Hey, use my referral link to get 1 month off Wispr Flow!</div>
      <div className="list-row">my email address <span className="arrow">→</span> satheesh.atluri56@gmail.com</div>
      <div className="list-row">organize thoughts prompt <span className="arrow">→</span> Organize these unstructured thoughts into a clear, polished version...</div>
    </div>
  </div>
);
