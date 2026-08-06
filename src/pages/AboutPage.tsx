import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { ABOUT_NAV_ITEMS, ABOUT_ARTICLES } from './data/aboutData';

interface AboutNavItem {
  key: string;
  labelVi: string;
  labelEn: string;
}

const logo = '/brand/fakebook-minimal-cropped.png';
import { FaChevronDown, FaGlobe, FaShieldAlt } from 'react-icons/fa';
import './AboutPage.css';
import { useI18n } from '../i18n';

const AboutPage: React.FC<{ onBack?: () => void; initialTopic?: string }> = ({ onBack }) => {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const { t, locale } = useI18n();



  return (
    <div className="about-wrapper">
      {/* Top Nav */}
      <nav className="about-nav">
        <div className="about-nav-left">
          <img src={logo} alt="Fakebook" className="about-logo" onClick={() => onBack ? onBack() : navigate('/')} style={{cursor: 'pointer', height: 32}} />
          <span className="about-nav-brand">{t('aboutGroupTitle')}</span>
          <div className="about-nav-links">
            <a href="#news" style={{textDecoration: 'none', color: 'inherit'}}><button>{t('aboutNews')}</button></a>
          </div>
        </div>
        <div className="about-nav-right">
        </div>
      </nav>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-bg">
          <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" alt="People running" />
        </div>
        <div className="about-hero-content">
          <h1 dangerouslySetInnerHTML={{ __html: t('aboutHeroTitle').replace('\\n', '<br/>') }}></h1>
        </div>
      </section>

      {/* News Section */}
      <section id="news" className="about-section text-center">
        <h2>{t('aboutNewsTitle')}</h2>
        <div className="news-grid">
          <div className="news-card">
            <div style={{ height: '200px', background: '#e7f3ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', borderRadius: '12px 12px 0 0' }}>
              <FaGlobe />
            </div>
            <p>{t('aboutNews1')}</p>
          </div>
          <div className="news-card">
            <div style={{ height: '200px', background: '#e7f3ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', borderRadius: '12px 12px 0 0' }}>
              <FaShieldAlt />
            </div>
            <p>{t('aboutNews2')}</p>
          </div>
        </div>
      </section>


      {/* Leadership */}
      <section className="about-section bg-light">
        <div className="leadership-layout">
          <div className="leadership-text">
            <h2>{t('aboutLeadershipTitle')}</h2>
            <p>{t('aboutLeadershipDesc')}</p>
            <button className="pill-btn primary">{t('aboutLeadershipBtn')}</button>
          </div>
          <div className="leadership-img">
            <img src="/leader.png" alt="Leadership" />
          </div>
        </div>
      </section>

      {/* Markdown Content Section (Our Detailed Documentation) */}
      <section className="about-section">
        <h2 className="text-center" style={{marginBottom: 40}}>{t('aboutDocsTitle')}</h2>
        <div className="about-accordion-list">
          {ABOUT_NAV_ITEMS.map((item: AboutNavItem) => (
            <div key={item.key} className="about-accordion-item">
              <button 
                className={`about-accordion-header ${activeArticleId === item.key ? 'open' : ''}`}
                onClick={() => setActiveArticleId(activeArticleId === item.key ? null : item.key)}
              >
                {locale === 'vi' ? item.labelVi : item.labelEn}
                <FaChevronDown className="about-chevron" />
              </button>
              {activeArticleId === item.key && (
                <div className="about-accordion-body markdown-content">
                  {locale === 'vi' 
                    ? ABOUT_ARTICLES.find(a => a.id === item.key + '-content')?.contentVi 
                    : ABOUT_ARTICLES.find(a => a.id === item.key + '-content')?.contentEn}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="about-footer">
        <div className="about-footer-cols">
          <div className="col">
            <h4>{t('aboutProducts')}</h4>
            <p><a href="https://fakebook.tech" target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>Fakebook</a></p>
          </div>
          <div className="col">
            <h4>{t('aboutResources')}</h4>
            <p onClick={() => navigate('/privacy')} style={{cursor: 'pointer'}}>{t('aboutPrivacyCentre')}</p>
            <p onClick={() => navigate('/help')} style={{cursor: 'pointer'}}>{t('aboutHelpCentre')}</p>
            <p onClick={() => navigate('/policies')} style={{cursor: 'pointer'}}>{t('aboutPolicies')}</p>
          </div>
        </div>
        <div className="about-footer-bottom">
          <img src={logo} alt="Meta" style={{height: 32, cursor: 'pointer'}} onClick={() => onBack ? onBack() : navigate('/')} />
          <span>{t('aboutCopyright')}</span>
        </div>
      </footer>
    </div>
  );
};

export { AboutPage };
