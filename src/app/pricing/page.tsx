'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function PricingPage() {
    const [currentSlide, setCurrentSlide] = useState(1); // Start with middle card (₹5,999)

    const plans = [
        {
            name: "14-Day Free Trial",
            price: "₹0",
            period: "14 Days",
            description: "Try all features risk-free",
            features: [
                "Full Lab Management System",
                "Complete OPD Module",
                "Patient Management",
                "Report Generation",
                "WhatsApp Integration",
                "All Premium Features",
                "Email Support"
            ],
            cta: "Start Free Trial",
            popular: false,
            color: "from-green-600 to-emerald-600"
        },
        {
            name: "Lab Essentials",
            price: "₹5,999",
            period: "per year",
            description: "Perfect for diagnostic centers",
            features: [
                "Complete Lab Information System",
                "Auto-calculation Engine",
                "Sample Tracking & Barcoding",
                "Professional PDF Reports",
                "WhatsApp Report Delivery",
                "100+ Test Templates",
                "Machine Integration",
                "Priority Support"
            ],
            cta: "Get Started",
            popular: true,
            color: "from-blue-600 to-indigo-600"
        },
        {
            name: "Full Access",
            price: "₹12,999",
            period: "per year",
            description: "Complete hospital management",
            features: [
                "Everything in Lab Essentials",
                "Complete OPD Management",
                "Queue Management System",
                "Doctor Dashboard",
                "E-Prescriptions",
                "Patient History Tracking",
                "Analytics & Reports",
                "Pharmacy Integration",
                "Multi-user Access",
                "24/7 Premium Support"
            ],
            cta: "Get Full Access",
            popular: false,
            color: "from-purple-600 to-pink-600"
        }
    ];

    const nextSlide = () => {
        setCurrentSlide((prev) => (prev + 1) % plans.length);
    };

    const prevSlide = () => {
        setCurrentSlide((prev) => (prev - 1 + plans.length) % plans.length);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
            {/* Header */}
            <nav className="bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100 py-4">
                <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
                    <Link href="/" className="flex items-center gap-3 no-underline group">
                        <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-700 transition">
                            <i className="fas fa-hospital-user text-white text-xl"></i>
                        </div>
                        <span className="text-2xl font-bold tracking-tight text-slate-900">
                            Spotnet <span className="text-blue-600">MedOS</span>
                        </span>
                    </Link>
                    <Link href="/" className="text-slate-600 hover:text-blue-600 font-semibold transition">
                        <i className="fas fa-arrow-left mr-2"></i>Back to Home
                    </Link>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="py-20 text-center">
                <div className="max-w-4xl mx-auto px-6">
                    <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6">
                        Simple, Transparent Pricing
                    </h1>
                    <p className="text-xl text-slate-600 mb-4">
                        Choose the perfect plan for your healthcare facility
                    </p>
                    <p className="text-lg text-blue-600 font-semibold">
                        🎉 Start with a 14-day free trial • No credit card required
                    </p>
                </div>
            </section>

            {/* Pricing Cards - Desktop View */}
            <section className="pb-20 hidden md:block">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid md:grid-cols-3 gap-8">
                        {plans.map((plan, index) => (
                            <div
                                key={index}
                                className={`relative bg-white rounded-2xl shadow-xl overflow-hidden transform transition-all duration-300 hover:scale-105 ${plan.popular ? 'ring-4 ring-blue-500 scale-105' : ''
                                    }`}
                            >
                                {plan.popular && (
                                    <div className="absolute top-0 right-0 bg-blue-600 text-white px-4 py-1 text-sm font-bold rounded-bl-lg">
                                        MOST POPULAR
                                    </div>
                                )}

                                <div className={`bg-gradient-to-r ${plan.color} p-8 text-white`}>
                                    <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                                    <div className="flex items-baseline gap-2 mb-2">
                                        <span className="text-5xl font-extrabold">{plan.price}</span>
                                        <span className="text-lg opacity-90">/{plan.period}</span>
                                    </div>
                                    <p className="opacity-90">{plan.description}</p>
                                </div>

                                <div className="p-8">
                                    <ul className="space-y-4 mb-8">
                                        {plan.features.map((feature, idx) => (
                                            <li key={idx} className="flex items-start gap-3">
                                                <i className="fas fa-check-circle text-green-500 mt-1"></i>
                                                <span className="text-gray-700">{feature}</span>
                                            </li>
                                        ))}
                                    </ul>

                                    <Link
                                        href="/register"
                                        className={`block w-full text-center bg-gradient-to-r ${plan.color} text-white py-4 rounded-lg font-bold text-lg hover:shadow-xl transition-all transform hover:-translate-y-1 no-underline`}
                                    >
                                        {plan.cta}
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Pricing Cards - Mobile Slider */}
            <section className="pb-20 md:hidden">
                <div className="max-w-md mx-auto px-6">
                    <div className="relative">
                        {/* Current Card */}
                        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
                            {plans[currentSlide].popular && (
                                <div className="bg-blue-600 text-white px-4 py-2 text-center text-sm font-bold">
                                    MOST POPULAR
                                </div>
                            )}

                            <div className={`bg-gradient-to-r ${plans[currentSlide].color} p-8 text-white`}>
                                <h3 className="text-2xl font-bold mb-2">{plans[currentSlide].name}</h3>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-4xl font-extrabold">{plans[currentSlide].price}</span>
                                    <span className="text-base opacity-90">/{plans[currentSlide].period}</span>
                                </div>
                                <p className="opacity-90">{plans[currentSlide].description}</p>
                            </div>

                            <div className="p-6">
                                <ul className="space-y-3 mb-6">
                                    {plans[currentSlide].features.map((feature, idx) => (
                                        <li key={idx} className="flex items-start gap-2 text-sm">
                                            <i className="fas fa-check-circle text-green-500 mt-0.5"></i>
                                            <span className="text-gray-700">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                <Link
                                    href="/register"
                                    className={`block w-full text-center bg-gradient-to-r ${plans[currentSlide].color} text-white py-3 rounded-lg font-bold hover:shadow-xl transition-all no-underline`}
                                >
                                    {plans[currentSlide].cta}
                                </Link>
                            </div>
                        </div>

                        {/* Navigation Arrows */}
                        <button
                            onClick={prevSlide}
                            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 bg-white rounded-full w-10 h-10 shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition"
                        >
                            <i className="fas fa-chevron-left"></i>
                        </button>
                        <button
                            onClick={nextSlide}
                            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 bg-white rounded-full w-10 h-10 shadow-lg flex items-center justify-center text-gray-700 hover:bg-gray-100 transition"
                        >
                            <i className="fas fa-chevron-right"></i>
                        </button>

                        {/* Dots Indicator */}
                        <div className="flex justify-center gap-2 mt-6">
                            {plans.map((_, index) => (
                                <button
                                    key={index}
                                    onClick={() => setCurrentSlide(index)}
                                    className={`w-2 h-2 rounded-full transition-all ${currentSlide === index ? 'bg-blue-600 w-8' : 'bg-gray-300'
                                        }`}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            {/* FAQ Section */}
            <section className="py-20 bg-white">
                <div className="max-w-4xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-center text-slate-900 mb-12">
                        Frequently Asked Questions
                    </h2>
                    <div className="space-y-6">
                        <div className="bg-slate-50 p-6 rounded-xl">
                            <h3 className="font-bold text-lg text-slate-900 mb-2">
                                Can I upgrade or downgrade my plan?
                            </h3>
                            <p className="text-slate-600">
                                Yes! You can upgrade or downgrade your plan at any time. Changes will be reflected in your next billing cycle.
                            </p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl">
                            <h3 className="font-bold text-lg text-slate-900 mb-2">
                                What happens after the free trial?
                            </h3>
                            <p className="text-slate-600">
                                After 14 days, you can choose to subscribe to any paid plan. Your data will be preserved, and you'll continue with uninterrupted service.
                            </p>
                        </div>
                        <div className="bg-slate-50 p-6 rounded-xl">
                            <h3 className="font-bold text-lg text-slate-900 mb-2">
                                Is there a setup fee?
                            </h3>
                            <p className="text-slate-600">
                                No setup fees! The price you see is the price you pay. We also provide free onboarding support to help you get started.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
                <div className="max-w-4xl mx-auto px-6 text-center">
                    <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Healthcare Facility?</h2>
                    <p className="text-xl mb-8 opacity-90">
                        Join 500+ healthcare providers already using Spotnet MedOS
                    </p>
                    <Link
                        href="/register"
                        className="inline-block bg-white text-blue-600 px-10 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition-all shadow-xl hover:shadow-2xl transform hover:-translate-y-1 no-underline"
                    >
                        Start Your Free Trial Now
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-300 py-12">
                <div className="max-w-7xl mx-auto px-6 text-center">
                    <p className="mb-4">© 2025 Spotnet Services. All rights reserved.</p>
                    <div className="flex justify-center gap-6">
                        <Link href="/" className="hover:text-white transition">Home</Link>
                        <Link href="#" className="hover:text-white transition">Privacy Policy</Link>
                        <Link href="#" className="hover:text-white transition">Terms of Service</Link>
                    </div>
                </div>
            </footer>
        </div>
    );
}
