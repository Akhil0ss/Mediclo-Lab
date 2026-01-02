"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";
import LegalModal from "@/components/LegalModals";

export default function HomePage() {
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [legalModal, setLegalModal] = useState<{ isOpen: boolean; type: 'privacy' | 'terms' }>({
    isOpen: false,
    type: 'privacy'
  });

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white font-sans text-slate-800">
      {/* Navigation */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 border-b ${scrolled ? "bg-white/95 backdrop-blur-md shadow-sm border-gray-100 py-3" : "bg-white/90 border-transparent py-5"}`}>
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <Link href="/" className="flex items-center gap-3 no-underline group">
            <div className="bg-blue-600 p-2 rounded-lg group-hover:bg-blue-700 transition">
              <i className="fas fa-hospital-user text-white text-xl"></i>
            </div>
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              Spotnet <span className="text-blue-600">MedOS</span>
            </span>
          </Link>

          {/* Desktop Menu */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#solutions" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition no-underline uppercase tracking-wide">Solutions</a>
            <a href="#features" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition no-underline uppercase tracking-wide">Features</a>
            <a href="#testimonials" className="text-sm font-semibold text-slate-600 hover:text-blue-600 transition no-underline uppercase tracking-wide">Reviews</a>

            <div className="flex items-center gap-4">
              <Link href="/patient" className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-full font-bold shadow-md transition no-underline flex items-center text-sm">
                <i className="fas fa-user-injured mr-2"></i>Patient Login
              </Link>

              {user ? (
                <Link href="/dashboard" className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-full font-bold shadow-md transition no-underline flex items-center text-sm">
                  <i className="fas fa-th-large mr-2"></i>Dashboard
                </Link>
              ) : (
                <Link href="/login" className="bg-slate-900 hover:bg-slate-800 text-white px-5 py-2.5 rounded-full font-bold shadow-md transition no-underline flex items-center text-sm">
                  <i className="fas fa-user-md mr-2"></i>Dashboard Login
                </Link>
              )}
            </div>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden text-slate-700 text-2xl p-2"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            <i className={`fas ${isMobileMenuOpen ? 'fa-times' : 'fa-bars'}`}></i>
          </button>
        </div>

        {/* Mobile Menu Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-white border-b border-gray-100 shadow-xl p-6 flex flex-col gap-6 animate-in slide-in-from-top-5">
            <a href="#solutions" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-semibold text-slate-700">Solutions</a>
            <a href="#features" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-semibold text-slate-700">Features</a>
            <a href="#testimonials" onClick={() => setIsMobileMenuOpen(false)} className="text-lg font-semibold text-slate-700">Reviews</a>

            <div className="h-px bg-gray-100 my-2"></div>

            <Link href="/patient" className="bg-green-600 text-white px-5 py-3 rounded-xl font-bold text-center flex items-center justify-center">
              <i className="fas fa-user-injured mr-2"></i>Patient Login
            </Link>

            {user ? (
              <Link href="/dashboard" className="bg-blue-600 text-white px-5 py-3 rounded-xl font-bold text-center flex items-center justify-center">
                <i className="fas fa-th-large mr-2"></i>Dashboard
              </Link>
            ) : (
              <Link href="/login" className="bg-slate-900 text-white px-5 py-3 rounded-xl font-bold text-center flex items-center justify-center">
                <i className="fas fa-user-md mr-2"></i>Dashboard Login
              </Link>
            )}
          </div>
        )}
      </nav>

      {/* Hero Section */}
      < header className="relative pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden bg-slate-50" >
        <div className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-16 items-center">
          <div className="relative z-10 animate-fade-in-up">
            <span className="inline-block py-1 px-3 rounded-full bg-blue-100 text-blue-700 text-sm font-bold mb-6 tracking-wide">
              TRUSTED BY 500+ HEALTHCARE FACILITIES
            </span>
            <h1 className="text-5xl lg:text-7xl font-extrabold text-slate-900 leading-[1.1] mb-8">
              The Standard for <br />
              <span className="text-blue-600">Modern Healthcare.</span>
            </h1>
            <p className="text-xl text-slate-600 mb-10 leading-relaxed max-w-lg">
              Streamline your hospital operations with our enterprise-grade OPD, Lab, and Patient Management System. Designed for precision and care.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register" className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 no-underline">
                Start Free Trial <i className="fas fa-arrow-right text-sm"></i>
              </Link>
              <Link href="/login" className="px-8 py-4 bg-white text-slate-700 border border-slate-200 rounded-xl font-bold text-lg hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 no-underline">
                View Live Demo
              </Link>
            </div>

            <div className="mt-12 flex items-center gap-6 text-sm text-slate-500 font-medium">
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle text-green-500"></i> HIPAA Compliant
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle text-green-500"></i> Local Support
              </div>
              <div className="flex items-center gap-2">
                <i className="fas fa-check-circle text-green-500"></i> 99.9% Uptime
              </div>
            </div>
          </div>

          <div className="relative z-10 h-[400px] lg:h-[600px] w-full">
            <div className="absolute inset-0 bg-gradient-to-tr from-blue-600/20 to-transparent rounded-3xl transform rotate-3 scale-105 -z-10"></div>
            <Image
              src="https://images.unsplash.com/photo-1638202993928-7267aad84c31?auto=format&fit=crop&q=80&w=1000"
              alt="Medical Team"
              fill
              className="object-cover rounded-3xl shadow-2xl border-4 border-white"
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
            {/* Floating Badge */}
            <div className="absolute -bottom-10 -left-10 bg-white p-6 rounded-2xl shadow-xl border border-slate-100 hidden lg:block">
              <div className="flex items-center gap-4 mb-2">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center text-green-600">
                  <i className="fas fa-user-check text-xl"></i>
                </div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">12k+</div>
                  <div className="text-xs text-slate-500 uppercase font-bold">Patients Served</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header >

      {/* Solutions Section */}
      < section id="solutions" className="py-24 bg-white" >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center max-w-3xl mx-auto mb-20">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-6">Complete Clinical Workflow Solution</h2>
            <p className="text-lg text-slate-600 leading-relaxed">
              We don't just digitize paper records—we optimize your entire clinical workflow to save time, reduce errors, and improve patient outcomes.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Card 1 */}
            <div className="group p-8 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-100 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-blue-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-vial"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Laboratory Information System</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Automated sample tracking, barcode integration, and instant report generation with auto-validation logic.
              </p>
              <ul className="space-y-2 mb-6 text-sm text-slate-500">
                <li className="flex items-center gap-2"><i className="fas fa-check text-blue-500 text-xs"></i> Auto-calculations</li>
                <li className="flex items-center gap-2"><i className="fas fa-check text-blue-500 text-xs"></i> Machine Integration</li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="group p-8 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-100 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-purple-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-user-md"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Out-Patient Department</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Seamless queue management, digital prescriptions, and patient history at the doctor's fingertips.
              </p>
              <ul className="space-y-2 mb-6 text-sm text-slate-500">
                <li className="flex items-center gap-2"><i className="fas fa-check text-purple-500 text-xs"></i> Live Queue Display</li>
                <li className="flex items-center gap-2"><i className="fas fa-check text-purple-500 text-xs"></i> E-Prescriptions</li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="group p-8 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white hover:border-blue-100 hover:shadow-xl transition-all duration-300">
              <div className="w-14 h-14 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center text-green-600 text-2xl mb-6 group-hover:scale-110 transition-transform">
                <i className="fas fa-chart-line"></i>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-4">Administrative Analytics</h3>
              <p className="text-slate-600 leading-relaxed mb-6">
                Real-time dashboards for revenue, patient footfall, and inventory management to make data-driven decisions.
              </p>
              <ul className="space-y-2 mb-6 text-sm text-slate-500">
                <li className="flex items-center gap-2"><i className="fas fa-check text-green-500 text-xs"></i> Revenue Reports</li>
                <li className="flex items-center gap-2"><i className="fas fa-check text-green-500 text-xs"></i> Inventory Alerts</li>
              </ul>
            </div>
          </div>
        </div>
      </section >

      {/* Feature Drilldown 1 */}
      < section className="py-24 bg-slate-50" >
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div className="order-2 md:order-1">
            <Image
              src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=1000"
              alt="Digital Reports"
              width={800}
              height={600}
              className="rounded-2xl shadow-xl w-full h-auto"
            />
          </div>
          <div className="order-1 md:order-2">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-xl mb-6"><i className="fas fa-file-medical-alt"></i></div>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Intelligent Reporting Engine</h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Create professional, easy-to-read lab reports that patients trust. Our improved PDF engine handles complex tabular data, ranges, and comments effortlessly.
            </p>
            <div className="space-y-4">
              <div className="flex gap-4">
                <div className="mt-1"><i className="fas fa-check-circle text-blue-600"></i></div>
                <div>
                  <h4 className="font-bold text-slate-900">Customizable Templates</h4>
                  <p className="text-sm text-slate-500">Match your hospital's branding perfectly.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1"><i className="fas fa-check-circle text-blue-600"></i></div>
                <div>
                  <h4 className="font-bold text-slate-900">WhatsApp Integration</h4>
                  <p className="text-sm text-slate-500">Send reports directly to patient's phone.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section >

      {/* Feature Drilldown 2 */}
      < section className="py-24 bg-white" >
        <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
          <div>
            <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-xl mb-6"><i className="fas fa-laptop-medical"></i></div>
            <h2 className="text-4xl font-bold text-slate-900 mb-6">Doctor-Centric Interface</h2>
            <p className="text-lg text-slate-600 mb-6 leading-relaxed">
              Designed by doctors, for doctors. View patient history, vitals, and previous reports in a single, unified dashboard during consultation.
            </p>
            <Link href="/register" className="text-blue-600 font-bold hover:text-blue-700 flex items-center gap-2 no-underline">
              Explore Doctor Module <i className="fas fa-arrow-right"></i>
            </Link>
          </div>
          <div>
            <Image
              src="https://images.unsplash.com/photo-1551076805-e1869033e561?auto=format&fit=crop&q=80&w=1000"
              alt="Doctor with Tablet"
              width={800}
              height={600}
              className="rounded-2xl shadow-xl w-full h-auto"
            />
          </div>
        </div>
      </section >

      {/* Trust/CTA Area */}
      < section className="py-24 bg-slate-900 text-white relative overflow-hidden" >
        <div className="absolute inset-0 bg-blue-600/10"></div>
        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <h2 className="text-3xl md:text-5xl font-bold mb-8">Ready to modernize your facility?</h2>
          <p className="text-xl text-slate-300 mb-12 max-w-2xl mx-auto">
            Join the network of forward-thinking healthcare providers who choose reliability and precision.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-6">
            <Link href="/register" className="bg-white text-slate-900 px-10 py-4 rounded-full font-bold text-lg hover:bg-blue-50 transition-all shadow-lg no-underline">
              Get Started Now
            </Link>
            <Link href="https://wa.me/917619948657" className="bg-transparent border-2 border-slate-700 text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-slate-800 transition-all no-underline">
              Talk to Sales
            </Link>
          </div>
        </div>
      </section >

      {/* Testimonials Section - Sliding Carousel */}
      < section id="testimonials" className="py-24 bg-white overflow-hidden" >
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 mb-4">Trusted by Healthcare Professionals</h2>
            <p className="text-lg text-slate-600">See what our clients say about Spotnet MedOS</p>
          </div>

          <div className="relative">
            {/* Testimonials Slider */}
            <div className="flex gap-8 animate-scroll-testimonials">
              {/* Testimonial 1 */}
              <div className="min-w-[350px] md:min-w-[400px] bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-2xl shadow-lg border border-blue-100">
                <div className="flex items-center gap-1 mb-4 text-yellow-500">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  "Spotnet MedOS transformed our lab operations completely. The auto-calculation feature saves us hours every day, and the PDF reports are professional and error-free."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    DR
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Dr. Rajesh Kumar</h4>
                    <p className="text-sm text-gray-600">Director, Apollo Diagnostics, Mumbai</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 2 */}
              <div className="min-w-[350px] md:min-w-[400px] bg-gradient-to-br from-green-50 to-blue-50 p-8 rounded-2xl shadow-lg border border-green-100">
                <div className="flex items-center gap-1 mb-4 text-yellow-500">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  "The OPD module is incredibly intuitive. Our doctors love the patient history integration, and queue management has never been smoother. Highly recommended!"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    SM
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Dr. Sneha Mehta</h4>
                    <p className="text-sm text-gray-600">Chief Medical Officer, HealthCare Plus, Delhi</p>
                  </div>
                </div>
              </div>

              {/* Testimonial 3 */}
              <div className="min-w-[350px] md:min-w-[400px] bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-2xl shadow-lg border border-purple-100">
                <div className="flex items-center gap-1 mb-4 text-yellow-500">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  "Best investment we made for our clinic. The WhatsApp integration for reports is a game-changer. Our patients love the convenience and professionalism."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    AP
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Amit Patel</h4>
                    <p className="text-sm text-gray-600">Owner, City Lab & Diagnostics, Bangalore</p>
                  </div>
                </div>
              </div>

              {/* Duplicate for seamless loop */}
              <div className="min-w-[350px] md:min-w-[400px] bg-gradient-to-br from-blue-50 to-purple-50 p-8 rounded-2xl shadow-lg border border-blue-100">
                <div className="flex items-center gap-1 mb-4 text-yellow-500">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  "Spotnet MedOS transformed our lab operations completely. The auto-calculation feature saves us hours every day, and the PDF reports are professional and error-free."
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    DR
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Dr. Rajesh Kumar</h4>
                    <p className="text-sm text-gray-600">Director, Apollo Diagnostics, Mumbai</p>
                  </div>
                </div>
              </div>

              <div className="min-w-[350px] md:min-w-[400px] bg-gradient-to-br from-green-50 to-blue-50 p-8 rounded-2xl shadow-lg border border-green-100">
                <div className="flex items-center gap-1 mb-4 text-yellow-500">
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                  <i className="fas fa-star"></i>
                </div>
                <p className="text-gray-700 mb-6 italic leading-relaxed">
                  "The OPD module is incredibly intuitive. Our doctors love the patient history integration, and queue management has never been smoother. Highly recommended!"
                </p>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    SM
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Dr. Sneha Mehta</h4>
                    <p className="text-sm text-gray-600">Chief Medical Officer, HealthCare Plus, Delhi</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section >

      {/* Footer */}
      < footer className="bg-slate-50 border-t border-slate-200 pt-20 pb-10" >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-12 mb-16">
            <div className="col-span-2">
              <Link href="/" className="flex items-center gap-2 mb-6 no-underline">
                <span className="text-2xl font-bold text-slate-900">Spotnet <span className="text-blue-600">MedOS</span></span>
              </Link>
              <p className="text-slate-500 leading-relaxed max-w-sm mb-6">
                The most advanced operating system for hospitals and diagnostic centers. Secure, fast, and reliable.
              </p>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-6">Product</h4>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li><a href="#features" className="hover:text-blue-600 transition no-underline">Features</a></li>
                <li><a href="/pricing" className="hover:text-blue-600 transition no-underline">Pricing</a></li>
                <li><a href="#testimonials" className="hover:text-blue-600 transition no-underline">Reviews</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold text-slate-900 mb-6">Contact</h4>
              <ul className="space-y-4 text-slate-500 text-sm">
                <li className="flex items-start gap-3">
                  <i className="fas fa-map-marker-alt mt-1 text-slate-400"></i>
                  <span>Mumbai, Maharashtra, India</span>
                </li>
                <li className="flex items-center gap-3">
                  <i className="fas fa-phone text-slate-400"></i>
                  <span>+91 76199 48657</span>
                </li>
                <li className="flex items-center gap-3">
                  <i className="fas fa-envelope text-slate-400"></i>
                  <span>sales@spotnet.in</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-400">
            <div>© 2025 Spotnet Services. All rights reserved.</div>
            <div className="flex gap-8">
              <button
                onClick={() => setLegalModal({ isOpen: true, type: 'privacy' })}
                className="hover:text-blue-600 transition bg-transparent border-none cursor-pointer text-slate-400"
              >
                Privacy Policy
              </button>
              <button
                onClick={() => setLegalModal({ isOpen: true, type: 'terms' })}
                className="hover:text-blue-600 transition bg-transparent border-none cursor-pointer text-slate-400"
              >
                Terms of Service
              </button>
            </div>
          </div>
        </div>
      </footer >

      {/* Legal Modal */}
      < LegalModal
        isOpen={legalModal.isOpen}
        type={legalModal.type}
        onClose={() => setLegalModal({ ...legalModal, isOpen: false })
        }
      />

      {/* Floating WhatsApp Action Button */}
      <a
        href="https://wa.me/917619948657?text=Hi%2C%20I%27m%20interested%20in%20Spotnet%20MedOS.%20I%27d%20like%20to%20know%20more%20about%20your%20hospital%20management%20system."
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-[#25D366] text-white px-4 py-3 rounded-full shadow-2xl hover:bg-[#128C7E] transition-all hover:-translate-y-1 group no-underline"
      >
        <i className="fab fa-whatsapp text-2xl"></i>
        <span className="font-bold pr-1">Chat Support</span>
      </a>
    </div >
  );
}
