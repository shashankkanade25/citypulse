import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import Link from "next/link";
import HomeHeroActions from "@/components/HomeHeroActions";

export default async function Home() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ fontFamily: "'Open Sans', sans-serif", backgroundColor: '#F4F5F7' }}>
      <main>
        {/* Hero Section */}
        <section className="relative py-8 lg:py-10">
          <div className="max-w-7xl mx-auto px-3 lg:px-4">
            <div className="bg-white rounded-3xl px-6 lg:px-8 py-8 lg:py-10 shadow-sm">
              <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
              {/* Left Content */}
              <div className="space-y-8">
                {/* Main Heading */}
                <div className="space-y-5">
                  <h1 
                    className="text-3xl sm:text-4xl lg:text-6xl xl:text-7xl font-bold tracking-tight leading-[1.1]" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Your Perfect City Starts with CityPulse
                  </h1>
                  <p className="text-base lg:text-lg leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    Real-time infrastructure monitoring with transparency. Report your issue today.
                  </p>
                </div>

                {/* Primary actions */}
                <div className="max-w-md w-full">
                  <HomeHeroActions />
                </div>
              </div>

              {/* Right Image */}
              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src="https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?q=80&w=1200&auto=format&fit=crop"
                    alt="Beautiful cityscape"
                    className="w-full h-64 sm:h-80 lg:h-150 object-cover"
                  />
                </div>
              </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="text-4xl lg:text-5xl font-bold mb-2" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  1,247
                </div>
                <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Total Reports</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="text-4xl lg:text-5xl font-bold mb-2" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  892
                </div>
                <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Resolved</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="text-4xl lg:text-5xl font-bold mb-2" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  234
                </div>
                <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>In Progress</div>
              </div>
              <div className="bg-white rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div 
                  className="text-4xl lg:text-5xl font-bold mb-2" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  3.2d
                </div>
                <div className="text-sm font-semibold" style={{ color: '#131C15', opacity: 0.7 }}>Avg Resolution</div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 
                className="text-4xl lg:text-5xl font-bold mb-4" 
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                How It <span style={{ color: '#09E0F7' }}>Works</span>
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: '#131C15', opacity: 0.7 }}>
                Three simple steps to make your voice heard and drive real change
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative group">
                <div className="rounded-2xl p-8 hover:shadow-lg transition-all duration-300" style={{ backgroundColor: 'rgba(9, 224, 247, 0.1)', border: '1px solid rgba(9, 224, 247, 0.2)' }}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border mb-6" style={{ borderColor: 'rgba(9, 224, 247, 0.35)', backgroundColor: '#09E0F7' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=200&auto=format&fit=crop"
                      alt="Report"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Report
                  </h3>
                  <p className="leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    Snap a photo, add location, and describe the issue. Our AI classifies severity automatically.
                  </p>
                </div>
              </div>

              {/* Step 2 */}
              <div className="relative group">
                <div className="rounded-2xl p-8 hover:shadow-lg transition-all duration-300" style={{ backgroundColor: 'rgba(9, 224, 247, 0.1)', border: '1px solid rgba(9, 224, 247, 0.2)' }}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border mb-6" style={{ borderColor: 'rgba(9, 224, 247, 0.35)', backgroundColor: '#09E0F7' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=200&auto=format&fit=crop"
                      alt="Track"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Track
                  </h3>
                  <p className="leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    Watch real-time updates as authorities assign, work on, and resolve your report.
                  </p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="relative group">
                <div className="rounded-2xl p-8 hover:shadow-lg transition-all duration-300" style={{ backgroundColor: 'rgba(9, 224, 247, 0.1)', border: '1px solid rgba(9, 224, 247, 0.2)' }}>
                  <div className="w-14 h-14 rounded-xl overflow-hidden border mb-6" style={{ borderColor: 'rgba(9, 224, 247, 0.35)', backgroundColor: '#09E0F7' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?q=80&w=200&auto=format&fit=crop"
                      alt="Verify"
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Verify
                  </h3>
                  <p className="leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    See proof of work with geotagged images and resolution notes. Full transparency, always.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="py-20 text-white" style={{ backgroundColor: '#131C15' }}>
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 
                className="text-4xl lg:text-5xl font-bold mb-6" 
                style={{ fontFamily: "'Unbounded', sans-serif" }}
              >
                Our <span style={{ color: '#09E0F7' }}>Impact</span> in Action
              </h2>
              <p className="text-lg max-w-3xl mx-auto" style={{ opacity: 0.8 }}>
                CityPulse supports citizens and authorities who fight for transparency, equity, and justice in urban infrastructure.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              <div className="rounded-2xl p-8 transition-all" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div 
                  className="text-5xl font-bold mb-4" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  221+
                </div>
                <h3 
                  className="text-xl font-bold mb-3" 
                  style={{ fontFamily: "'Unbounded', sans-serif" }}
                >
                  Stories Shared
                </h3>
                <p style={{ opacity: 0.8 }}>
                  We helped communities document and share their experiences to inspire action.
                </p>
              </div>

              <div className="rounded-2xl p-8 transition-all" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div 
                  className="text-5xl font-bold mb-4" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  13+
                </div>
                <h3 
                  className="text-xl font-bold mb-3" 
                  style={{ fontFamily: "'Unbounded', sans-serif" }}
                >
                  Departments Active
                </h3>
                <p style={{ opacity: 0.8 }}>
                  We track local solutions that change lives, from water to road maintenance.
                </p>
              </div>

              <div className="rounded-2xl p-8 transition-all" style={{ backgroundColor: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
                <div 
                  className="text-5xl font-bold mb-4" 
                  style={{ fontFamily: "'Unbounded', sans-serif", color: '#09E0F7' }}
                >
                  590+
                </div>
                <h3 
                  className="text-xl font-bold mb-3" 
                  style={{ fontFamily: "'Unbounded', sans-serif" }}
                >
                  Citizens Helped
                </h3>
                <p style={{ opacity: 0.8 }}>
                  We supported communities and trained leaders to protect citizens&apos; interests.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 
                className="text-4xl lg:text-5xl font-bold mb-4" 
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                What We <span style={{ color: '#09E0F7' }}>Offer</span>
              </h2>
              <p className="text-lg max-w-2xl mx-auto" style={{ color: '#131C15', opacity: 0.7 }}>
                We support communities through transparency, real-time tracking, and accountability.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Feature 1 */}
              <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: '#09E0F7' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1526498460520-4c246339dccb?q=80&w=1200&auto=format&fit=crop"
                    alt="Helping voices"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-8">
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Helping Voices Be Heard
                  </h3>
                  <p className="mb-4 leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    We help people tell their stories with dignity, safety, and immediate reach to authorities.
                  </p>
                  <Link
                    href="/reporting"
                    className="inline-flex items-center font-semibold group"
                    style={{ color: '#09E0F7' }}
                  >
                    Report Issue
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: '#09E0F7' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=1200&auto=format&fit=crop"
                    alt="Real-time progress"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-8">
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Real-Time Progress
                  </h3>
                  <p className="mb-4 leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    Track every step of resolution with live updates and complete transparency.
                  </p>
                  <Link
                    href="/reporting/track"
                    className="inline-flex items-center font-semibold group"
                    style={{ color: '#09E0F7' }}
                  >
                    Track Reports
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>

              {/* Feature 3 */}
              <div className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="aspect-video relative overflow-hidden" style={{ backgroundColor: '#09E0F7' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.unsplash.com/photo-1556761175-4b46a572b786?q=80&w=1200&auto=format&fit=crop"
                    alt="Transparency"
                    className="absolute inset-0 w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div className="p-8">
                  <h3 
                    className="text-2xl font-bold mb-3" 
                    style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
                  >
                    Complete Transparency
                  </h3>
                  <p className="mb-4 leading-relaxed" style={{ color: '#131C15', opacity: 0.7 }}>
                    View city-wide performance metrics, department accountability, and resolution rates.
                  </p>
                  <Link
                    href="/reporting/transparency"
                    className="inline-flex items-center font-semibold group"
                    style={{ color: '#09E0F7' }}
                  >
                    View Dashboard
                    <svg className="w-5 h-5 ml-2 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Recent Updates Section */}
        <section className="py-20 bg-white">
          <div className="max-w-7xl mx-auto px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 
                className="text-4xl lg:text-5xl font-bold mb-4" 
                style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
              >
                Recent <span style={{ color: '#09E0F7' }}>Updates</span>
              </h2>
              <p className="text-lg max-w-3xl mx-auto" style={{ color: '#131C15', opacity: 0.7 }}>
                Real-time updates from every corner of the city. These are the changes happening right now.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {[
                { title: "Water leak resolved", time: "2 hours ago" },
                { title: "Road repair started", time: "5 hours ago" },
                { title: "Power restored", time: "1 day ago" },
                { title: "Waste collected", time: "2 days ago" }
              ].map((update, idx) => (
                <div key={idx} className="border-2 rounded-xl p-6 hover:shadow-md transition-all" style={{ backgroundColor: 'rgba(9, 224, 247, 0.05)', borderColor: 'rgba(9, 224, 247, 0.2)' }}>
                  <div className="text-base font-bold mb-2" style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}>
                    {update.title}
                  </div>
                  <div className="text-sm" style={{ color: '#131C15', opacity: 0.6 }}>{update.time}</div>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <Link
                href="/reporting/transparency"
                className="inline-flex items-center justify-center px-8 py-4 text-white rounded-lg transition-all font-semibold"
                style={{ backgroundColor: '#131C15' }}
              >
                View All Updates
              </Link>
              <Link
                href="/reporting/track"
                className="inline-flex items-center justify-center px-8 py-4 border-2 rounded-lg transition-all font-semibold"
                style={{ borderColor: '#131C15', color: '#131C15' }}
              >
                Track Your Reports
              </Link>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 text-white relative overflow-hidden" style={{ backgroundColor: '#09E0F7' }}>
          <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
            <h2 
              className="text-4xl lg:text-6xl font-bold mb-6" 
              style={{ fontFamily: "'Unbounded', sans-serif", color: '#131C15' }}
            >
              Join the CityPulse
            </h2>
            <p className="text-xl lg:text-2xl mb-8 font-normal" style={{ color: '#131C15' }}>
              Be the voice your city needs. Report, track, and drive change.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/reporting"
                className="inline-flex items-center px-10 py-5 rounded-lg font-bold text-lg transition-all shadow-lg"
                style={{ backgroundColor: '#131C15', color: '#FFFFFF' }}
              >
                Report Now
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                </svg>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
