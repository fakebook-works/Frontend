import React, { useState } from 'react';
import { navigate } from '../lib/router';
import { ABOUT_NAV_ITEMS, ABOUT_ARTICLES } from './data/aboutData';

interface AboutNavItem {
  key: string;
  labelVi: string;
  labelEn: string;
}

const logo = '/brand/fakebook-minimal-cropped.png';
import { FaPlay, FaChevronDown, FaGlobe, FaShieldAlt } from 'react-icons/fa';
import './AboutPage.css';

const AboutPage: React.FC<{ onBack?: () => void; initialTopic?: string }> = ({ onBack }) => {
  const [activeArticleId, setActiveArticleId] = useState<string | null>(null);
  const [isVi, setIsVi] = useState(true);



  return (
    <div className="about-wrapper">
      {/* Top Nav */}
      <nav className="about-nav">
        <div className="about-nav-left">
          <img src={logo} alt="Fakebook" className="about-logo" onClick={() => onBack ? onBack() : navigate('/')} style={{cursor: 'pointer', height: 32}} />
          <span className="about-nav-brand">About Group 36</span>
          <div className="about-nav-links">
            <a href="#products" style={{textDecoration: 'none', color: 'inherit'}}><button>What we build</button></a>
            <a href="#news" style={{textDecoration: 'none', color: 'inherit'}}><button>News</button></a>
          </div>
        </div>
        <div className="about-nav-right">
          <button onClick={() => setIsVi(!isVi)}>{isVi ? 'Tiếng Việt' : 'English'}</button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="about-hero">
        <div className="about-hero-bg">
          <img src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" alt="People running" />
        </div>
        <div className="about-hero-content">
          <h1>We're building the future<br/>of human connection.</h1>
          <button className="play-btn"><FaPlay style={{fontSize: 12, marginRight: 8}}/> Play video</button>
        </div>
      </section>

      {/* News Section */}
      <section id="news" className="about-section text-center">
        <h2>Catch up on the latest news</h2>
        <div className="news-grid">
          <div className="news-card">
            <div style={{ height: '200px', background: '#e7f3ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', borderRadius: '12px 12px 0 0' }}>
              <FaGlobe />
            </div>
            <p>Introducing new ways to connect with friends globally.</p>
          </div>
          <div className="news-card">
            <div style={{ height: '200px', background: '#e7f3ff', color: '#1877f2', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', borderRadius: '12px 12px 0 0' }}>
              <FaShieldAlt />
            </div>
            <p>Safety updates for teen accounts on Fakebook.</p>
          </div>
        </div>
      </section>


      {/* Connect Section */}
      <section id="products" className="about-section text-center">
        <h2>Connect in new ways with our products</h2>
        <button className="pill-btn primary">Explore our products</button>
        <div className="connect-video">
          <img src="https://images.unsplash.com/photo-1551818255-e6e10975bc17?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80" alt="Video thumbnail" />
        </div>
      </section>

      {/* Play a role */}
      <section className="about-section">
        <div className="role-layout">
          <div className="role-left">
            <h2>Play a role in building<br/>the future</h2>
            <p>We're looking for people who want to<br/>make a difference.</p>
            <button className="pill-btn primary">Explore careers</button>
          </div>
          <div className="role-right">
            <div className="role-item">
              <h3>Culture at Group 36</h3>
              <p>Find out what it's like to work with us.</p>
            </div>
            <div className="role-item">
              <h3>Careers in tech</h3>
              <p>Explore engineering and design roles.</p>
            </div>
            <div className="role-item">
              <h3>Internships</h3>
              <p>Start your career with our global program.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Leadership */}
      <section className="about-section bg-light">
        <div className="leadership-layout">
          <div className="leadership-text">
            <h2>Meet our leadership</h2>
            <p>Learn about the people leading our company into the future.</p>
            <button className="pill-btn primary">Meet our leaders</button>
          </div>
          <div className="leadership-img">
            <img src="/leader.png" alt="Leadership" />
          </div>
        </div>
      </section>

      {/* Markdown Content Section (Our Detailed Documentation) */}
      <section className="about-section">
        <h2 className="text-center" style={{marginBottom: 40}}>Detailed Documentation</h2>
        <div className="about-accordion-list">
          {ABOUT_NAV_ITEMS.map((item: AboutNavItem) => (
            <div key={item.key} className="about-accordion-item">
              <button 
                className={`about-accordion-header ${activeArticleId === item.key ? 'open' : ''}`}
                onClick={() => setActiveArticleId(activeArticleId === item.key ? null : item.key)}
              >
                {isVi ? item.labelVi : item.labelEn}
                <FaChevronDown className="about-chevron" />
              </button>
              {activeArticleId === item.key && (
                <div className="about-accordion-body markdown-content">
                  {isVi 
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
            <h4>Products</h4>
            <p><a href="https://fakebook.tech" target="_blank" rel="noopener noreferrer" style={{color: 'inherit', textDecoration: 'none'}}>Fakebook</a></p>
          </div>
          <div className="col">
            <h4>Resources</h4>
            <p onClick={() => navigate('/privacy')} style={{cursor: 'pointer'}}>Privacy Centre</p>
            <p onClick={() => navigate('/help')} style={{cursor: 'pointer'}}>Help Centre</p>
            <p onClick={() => navigate('/policies')} style={{cursor: 'pointer'}}>Policies</p>
          </div>
        </div>
        <div className="about-footer-bottom">
          <img src={logo} alt="Meta" style={{height: 32, cursor: 'pointer'}} onClick={() => onBack ? onBack() : navigate('/')} />
          <span>© 2026 Group 36</span>
        </div>
      </footer>
    </div>
  );
};

export { AboutPage };
