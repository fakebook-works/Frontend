import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { PRIVACY_NAV_ITEMS, PRIVACY_ARTICLES } from './data/privacyData';
import { useI18n } from '../i18n';
import { 
  FaHome, 
  FaLock, 
  FaShieldAlt, 
  FaChevronDown,
  FaChevronRight
} from 'react-icons/fa';
const logo = '/brand/fakebook-minimal-cropped.png';
import './PrivacyPage.css';

interface PrivacyNavItem {
  key: string;
  labelVi: string;
  labelEn: string;
}

const PrivacyPage: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState('home');
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [isPolicyExpanded, setIsPolicyExpanded] = useState(false);
  const { t, locale } = useI18n();

  const activeArticle = PRIVACY_ARTICLES.find(a => a.id === activeArticleId + '-content');

  const handleTabClick = (tab: string) => {
    setActiveTab(tab);
    setActiveArticleId(null);
  };

  const handleArticleClick = (id: string) => {
    setActiveTab('policy');
    setActiveArticleId(id);
  };

  const togglePolicyAccordion = () => {
    setIsPolicyExpanded(!isPolicyExpanded);
  };

  return (
    <div className="privacy-wrapper">
      {/* Sidebar */}
      <aside className="privacy-sidebar">
        <div className="privacy-sidebar-header" onClick={() => { if (onBack) onBack(); else navigate('/'); }} style={{cursor: 'pointer'}}>
          <img src={logo} alt="Meta" className="privacy-logo" onClick={(e) => { e.stopPropagation(); if (onBack) onBack(); else navigate('/'); }} style={{cursor: 'pointer'}} />
          <h2>{t('privacyCentreTitle')}</h2>
        </div>
        
        <nav className="privacy-nav">
          <button 
            className={`p-nav-item ${activeTab === 'home' ? 'active' : ''}`}
            onClick={() => handleTabClick('home')}
          >
            <div className="p-nav-left">
              <FaHome className="p-icon" /> <span>{t('privacyCentreHome')}</span>
            </div>
          </button>

          {/* Privacy Policy Accordion */}
          <div className="p-nav-group">
            <button 
              className={`p-nav-item ${activeTab === 'policy' ? 'active' : ''}`}
              onClick={togglePolicyAccordion}
            >
              <div className="p-nav-left">
                <FaLock className="p-icon" /> <span>{t('privacyPolicyTitle')}</span>
              </div>
              <FaChevronDown className={`p-chevron ${isPolicyExpanded ? 'open' : ''}`} />
            </button>
            
            {isPolicyExpanded && (
              <div className="p-nav-sublist">
                {PRIVACY_NAV_ITEMS.map((item: PrivacyNavItem) => (
                  <button 
                    key={item.key}
                    className={`p-sub-item ${activeArticleId === item.key ? 'active' : ''}`}
                    onClick={() => handleArticleClick(item.key)}
                  >
                    {locale === 'vi' ? item.labelVi : item.labelEn}
                  </button>
                ))}
              </div>
            )}
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="privacy-main">
        {/* Header inside main for close and lang */}
        <div className="privacy-top-bar">
        </div>

        <div className="privacy-content-scroll">
          {activeTab === 'home' && (
            <div className="p-home-view">
              <h1>{t('privacyCentrePageTitle')}</h1>
              <p className="p-subtitle">{t('privacyCentreSubtitle')}</p>
              
              <h3>{t('privacyBuildTitle')}</h3>
              <div className="p-cards-row">
                <div className="p-card">
                  <div className="p-card-icon" style={{background: '#e7f3ff', color: '#1877f2'}}><FaLock/></div>
                  <h4>{t('privacyMessagingTitle')}</h4>
                  <p>{t('privacyMessagingDesc')}</p>
                </div>
                <div className="p-card">
                  <div className="p-card-icon" style={{background: '#fbe9e7', color: '#f4511e'}}><FaShieldAlt/></div>
                  <h4>{t('privacyTeenTitle')}</h4>
                  <p>{t('privacyTeenDesc')}</p>
                </div>
              </div>



              <h3>{t('privacyLearnMore')}</h3>
              <div className="p-list-item" onClick={() => setIsPolicyExpanded(true)}>
                <div className="p-list-left">
                  <img src={logo} className="p-list-img" /> 
                  <div>
                    <h4>{t('privacyPolicyQuestion')}</h4>
                    <p>{t('privacyPolicyTitle')}</p>
                  </div>
                </div>
                <FaChevronRight className="p-list-arrow" />
              </div>
            </div>
          )}



          {activeTab === 'policy' && activeArticle && (
            <div className="p-article-view">
              <h1 className="article-main-title">{locale === 'vi' ? activeArticle.titleVi : activeArticle.titleEn}</h1>
              <div className="article-content-body">
                {locale === 'vi' ? activeArticle.contentVi : activeArticle.contentEn}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export { PrivacyPage };
