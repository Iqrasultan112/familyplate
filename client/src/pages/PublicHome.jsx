import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown, ArrowRight, CalendarDays, Check, ChefHat, Heart, Leaf,
  Menu, MessageCircle, ShoppingBasket, Sparkles, Users, Utensils,
} from 'lucide-react';
import mealIllustration from '../assets/family-meal.svg';
import './PublicHome.css';

const features = [
  { icon: CalendarDays, title: 'Plan the week', body: 'Put meals on the calendar in a few simple steps, then adjust whenever plans change.' },
  { icon: ShoppingBasket, title: 'Use what you have', body: 'Keep pantry items in view and make a shopping list for ingredients you are missing.' },
  { icon: Sparkles, title: 'Get meal ideas', body: 'Ask the meal helper for practical suggestions based on your time, ingredients, and preferences.' },
  { icon: Users, title: 'Plan together', body: 'Share meal choices, requests, and votes with family when you want to decide together.' },
];

export default function PublicHome() {
  return (
    <main className="public-home">
      <header className="public-nav">
        <a className="public-brand" href="#top" aria-label="FamilyPlate home">
          <span className="public-brand-mark"><Utensils size={23} strokeWidth={2.2} /></span>
          <span><strong>FamilyPlate</strong><small>MEALS MADE TOGETHER</small></span>
        </a>
        <nav className="public-nav-links" aria-label="Main navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#features">Features</a>
          <a href="#about">About</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className="public-nav-actions">
          <Link className="public-login" to="/login">Log in</Link>
          <Link className="public-signup" to="/register">Get started <ArrowRight size={17} /></Link>
        </div>
        <details className="public-mobile-menu">
          <summary aria-label="Open navigation"><Menu size={23} /></summary>
          <nav aria-label="Mobile navigation">
            <a href="#how-it-works">How it works</a><a href="#features">Features</a>
            <a href="#about">About</a><a href="#contact">Contact</a>
            <Link to="/login">Log in</Link><Link to="/register">Create account</Link>
          </nav>
        </details>
      </header>

      <section className="public-hero" id="top">
        <div className="public-hero-copy">
          <span className="public-eyebrow"><span /> A little easier, every mealtime</span>
          <h1>Make room for<br /><em>good food</em> and<br />more time together.</h1>
          <p>Plan family meals, find ideas with what is already in your kitchen, and keep everyone in the loop—all in one simple place.</p>
          <div className="public-hero-actions">
            <Link className="public-signup public-signup-large" to="/register">Create your free account <ArrowRight size={19} /></Link>
            <Link className="public-text-link" to="/login">I already have an account <ArrowRight size={16} /></Link>
          </div>
          <div className="public-reassurance"><Check size={16} /> Start with your own meal plan. Invite family only when you’re ready.</div>
        </div>
        <div className="public-hero-art">
          <img src={mealIllustration} alt="A freshly prepared family meal" />
          <div className="public-float-card public-float-plan"><span className="public-float-icon"><CalendarDays size={18} /></span><span><b>This week, sorted</b><small>Meals in one easy plan</small></span><Check className="public-float-check" size={19} /></div>
          <div className="public-float-card public-float-pantry"><span className="public-float-icon pantry"><Leaf size={18} /></span><span><b>Cook with what you have</b><small>Less guesswork, less waste</small></span></div>
          <span className="public-art-spark public-art-spark-one">✳</span><span className="public-art-spark public-art-spark-two">✳</span>
        </div>
        <a className="public-scroll-cue" href="#how-it-works"><ArrowDown size={15} /> See how it works</a>
      </section>

      <section className="public-benefits" aria-label="What FamilyPlate helps with">
        <div><CalendarDays /><span><b>Weekly meal plans</b><small>Make a plan that fits your week</small></span></div>
        <div><ShoppingBasket /><span><b>Pantry-aware lists</b><small>Know what to buy before you shop</small></span></div>
        <div><Heart /><span><b>Made for your household</b><small>Keep everyone’s preferences in mind</small></span></div>
      </section>

      <section className="public-section public-how" id="how-it-works">
        <div className="public-section-intro"><span className="public-eyebrow">SIMPLE FROM THE START</span><h2>Three small steps.<br /><em>One calmer kitchen.</em></h2><p>No complicated setup. Start planning for yourself, then bring your household in whenever it suits you.</p></div>
        <div className="public-steps">
          <article><span className="public-step-number">01</span><div className="public-step-icon"><ChefHat /></div><h3>Tell us what works</h3><p>Add your preferences, available ingredients, or simply how much time you have.</p></article>
          <article><span className="public-step-number">02</span><div className="public-step-icon"><Sparkles /></div><h3>Choose your meals</h3><p>Explore recipes and helpful suggestions, then pick what sounds good to you.</p></article>
          <article><span className="public-step-number">03</span><div className="public-step-icon"><CalendarDays /></div><h3>Plan and shop</h3><p>Add meals to your week and collect the missing ingredients in your shopping list.</p></article>
        </div>
      </section>

      <section className="public-section public-feature-section" id="features">
        <div className="public-section-heading"><span className="public-eyebrow">EVERYDAY HELP, ALL IN ONE PLACE</span><h2>Less juggling.<br /><em>More “what’s for dinner?” solved.</em></h2></div>
        <div className="public-feature-grid">{features.map(({ icon: Icon, title, body }, index) => <article className="public-feature-card" key={title}><div className={`public-feature-icon tone-${index}`}><Icon size={22} /></div><h3>{title}</h3><p>{body}</p></article>)}</div>
      </section>

      <section className="public-about" id="about">
        <div className="public-about-mark"><Utensils size={33} /></div>
        <div><span className="public-eyebrow">ABOUT FAMILYPLATE</span><h2>Good meals bring us<br />back to the table.</h2></div>
        <p>FamilyPlate is a practical meal-planning companion for real homes and busy days. It brings recipes, weekly planning, pantry tracking, and family choices together so deciding what to cook feels simpler.</p>
      </section>

      <section className="public-contact" id="contact">
        <div><span className="public-eyebrow">A QUESTION OR A SUGGESTION?</span><h2>We’d love to hear<br />what would help.</h2><p>Contact us about FamilyPlate, or make an account and start planning your meals today.</p></div>
        <div className="public-contact-actions"><a className="public-contact-mail" href="mailto:hello@familyplate.example"><MessageCircle size={19} /> hello@familyplate.example</a><Link className="public-signup" to="/register">Get started <ArrowRight size={17} /></Link></div>
      </section>

      <footer className="public-footer"><a className="public-brand" href="#top"><span className="public-brand-mark"><Utensils size={20} /></span><span><strong>FamilyPlate</strong><small>MEALS MADE TOGETHER</small></span></a><span>Thoughtful meal planning for everyday life.</span><div><a href="#about">About</a><a href="#contact">Contact</a><Link to="/login">Log in</Link><Link to="/register">Sign up</Link></div></footer>
    </main>
  );
}
