import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { POLICY_NAV_ITEMS, POLICY_ARTICLES } from './data/policyData';
const logo = '/brand/fakebook-minimal-cropped.png';
import { FaFileAlt, FaShieldAlt, FaUsers } from 'react-icons/fa';
import './PoliciesPage.css';

const PoliciesPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [isVi, setIsVi] = useState(true);

  const activeArticle = POLICY_ARTICLES.find(a => a.id === activeArticleId + '-content');

  return (
    <div className="policies-wrapper">
      {/* Top Header */}
      <header className="policies-header">
        <div className="policies-logo-area" onClick={(e) => { e.stopPropagation(); onBack ? onBack() : navigate('/'); }} style={{cursor: 'pointer'}}>
          <img src={logo} alt="Fakebook Logo" className="policies-logo" />
        </div>
        <div className="policies-lang-toggle">
          <button onClick={() => setIsVi(!isVi)} className="lang-text-btn">
            {isVi ? 'Tiếng Việt' : 'English (UK)'}
          </button>
        </div>
      </header>

      {!activeArticleId ? (
        <div className="policies-landing">
          <div className="policies-landing-main">
            <h4 className="policies-eyebrow">TERMS AND POLICIES</h4>
            <h1 className="policies-hero-title">Everything you need to know,<br/>all in one place.</h1>
            
            <h4 className="policies-eyebrow" style={{marginTop: '64px'}}>HOW WE WORK</h4>
            <div className="policies-cards-grid">
              {/* Card 1 */}
              <div className="policy-card" onClick={() => setActiveArticleId('cat-0')}>
                <FaFileAlt size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>Terms of Service</h3>
                <p>Terms you agree to when you use Fakebook.</p>
              </div>
              {/* Card 2 */}
              <div className="policy-card" onClick={() => navigate('/privacy')}>
                <FaShieldAlt size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>Privacy Policy</h3>
                <p>Information that we receive and how it's used.</p>
              </div>
              {/* Card 3 */}
              <div className="policy-card" onClick={() => setActiveArticleId('cat-1')}>
                <FaUsers size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>Community Standards</h3>
                <p>What isn't allowed and how to report abuse.</p>
              </div>
            </div>
          </div>

          <footer className="policies-footer">
            <div className="footer-content">
              <img src={logo} alt="Fakebook" style={{height: 32, cursor: 'pointer'}} onClick={() => onBack ? onBack() : navigate('/')} />
              <div className="footer-links">
                <span onClick={() => setActiveArticleId('cat-0')}>Terms of Service</span>
                <span onClick={() => navigate('/privacy')}>Privacy Policy</span>
                <span>Privacy Shield Notice</span>
                <span onClick={() => setActiveArticleId('cat-1')}>Community Standards</span>
                <span>More policies</span>
              </div>
            </div>
          </footer>
        </div>
      ) : (
        <div className="policies-article-layout">
          <aside className="policies-sidebar">
            <h3 className="policies-sidebar-title">Policies</h3>
            <ul className="policies-sidebar-list">
              {POLICY_NAV_ITEMS.map(item => (
                <li 
                  key={item.key} 
                  className={activeArticleId === item.key ? 'active' : ''}
                  onClick={() => setActiveArticleId(item.key)}
                >
                  {isVi ? item.labelVi : item.labelEn}
                </li>
              ))}
            </ul>
          </aside>
          
          <main className="policies-article-content">
            {isVi ? activeArticle?.contentVi : activeArticle?.contentEn}
          </main>
        </div>
      )}
    </div>
  );
};

export { PoliciesPage };
