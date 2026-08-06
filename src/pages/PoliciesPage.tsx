import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { POLICY_NAV_ITEMS, POLICY_ARTICLES } from './data/policyData';
const logo = '/brand/fakebook-minimal-cropped.png';
import { FaFileAlt, FaShieldAlt, FaUsers } from 'react-icons/fa';
import './PoliciesPage.css';
import { useI18n } from '../i18n';

const PoliciesPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const { t, locale } = useI18n();

  const activeArticle = POLICY_ARTICLES.find(a => a.id === activeArticleId + '-content');

  return (
    <div className="policies-wrapper">
      {/* Top Header */}
      <header className="policies-header">
        <div className="policies-logo-area" onClick={(e) => { e.stopPropagation(); if (onBack) onBack(); else navigate('/'); }} style={{cursor: 'pointer'}}>
          <img src={logo} alt="Fakebook Logo" className="policies-logo" />
        </div>
        <div className="policies-lang-toggle">
        </div>
      </header>

      {!activeArticleId ? (
        <div className="policies-landing">
          <div className="policies-landing-main">
            <h4 className="policies-eyebrow">{t('policiesEyebrow')}</h4>
            <h1 className="policies-hero-title">{t('policiesHeroTitle').split(', ').map((part, i, arr) => (
              <React.Fragment key={i}>
                {part}{i < arr.length - 1 ? ',' : ''}
                {i === 0 && <br/>}
              </React.Fragment>
            ))}</h1>
            
            <h4 className="policies-eyebrow" style={{marginTop: '64px'}}>{t('policiesHowWeWork')}</h4>
            <div className="policies-cards-grid">
              {/* Card 1 */}
              <div className="policy-card" onClick={() => setActiveArticleId('cat-0')}>
                <FaFileAlt size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>{t('policiesTermsTitle')}</h3>
                <p>{t('policiesTermsDesc')}</p>
              </div>
              {/* Card 2 */}
              <div className="policy-card" onClick={() => navigate('/privacy')}>
                <FaShieldAlt size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>{t('policiesPrivacyTitle')}</h3>
                <p>{t('policiesPrivacyDesc')}</p>
              </div>
              {/* Card 3 */}
              <div className="policy-card" onClick={() => setActiveArticleId('cat-1')}>
                <FaUsers size={48} color="#1877f2" style={{marginBottom: 16}} />
                <h3>{t('policiesStandardsTitle')}</h3>
                <p>{t('policiesStandardsDesc')}</p>
              </div>
            </div>
          </div>

          <footer className="policies-footer">
            <div className="footer-content">
              <img src={logo} alt="Fakebook" style={{height: 32, cursor: 'pointer'}} onClick={() => onBack ? onBack() : navigate('/')} />
              <div className="footer-links">
                <span onClick={() => setActiveArticleId('cat-0')}>{t('policiesTermsTitle')}</span>
                <span onClick={() => navigate('/privacy')}>{t('policiesPrivacyTitle')}</span>
                <span onClick={() => setActiveArticleId('cat-1')}>{t('policiesStandardsTitle')}</span>
              </div>
            </div>
          </footer>
        </div>
      ) : (
        <div className="policies-article-layout">
          <aside className="policies-sidebar">
            <h3 className="policies-sidebar-title">{t('policiesFooterTitle')}</h3>
            <ul className="policies-sidebar-list">
              {POLICY_NAV_ITEMS.map(item => (
                <li 
                  key={item.key} 
                  className={activeArticleId === item.key ? 'active' : ''}
                  onClick={() => setActiveArticleId(item.key)}
                >
                  {locale === 'vi' ? item.labelVi : item.labelEn}
                </li>
              ))}
            </ul>
          </aside>
          
          <main className="policies-article-content">
            {locale === 'vi' ? activeArticle?.contentVi : activeArticle?.contentEn}
          </main>
        </div>
      )}
    </div>
  );
};

export { PoliciesPage };
