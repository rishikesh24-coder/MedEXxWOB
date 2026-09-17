import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, AlertCircle, ShieldAlert, CheckCircle2, ChevronRight, Info } from 'lucide-react';

export const TermsPage = () => {
  useEffect(() => {
    document.title = 'MedEx | Terms & Conditions';
  }, []);

  const [activeSection, setActiveSection] = useState('term-1');

  const sections = [
    { id: 'term-1', title: '1. Acceptance of Terms' },
    { id: 'term-2', title: '2. Description of MedEx' },
    { id: 'term-3', title: '3. Hospital Eligibility' },
    { id: 'term-4', title: '4. Account Responsibilities' },
    { id: 'term-5', title: '5. Hospital Verification' },
    { id: 'term-6', title: '6. Medicine Listings' },
    { id: 'term-7', title: '7. Medicine Requests' },
    { id: 'term-8', title: '8. 48-Hour Request Expiry' },
    { id: 'term-9', title: '9. Payments & Escrow' },
    { id: 'term-10', title: '10. Logistics & Cold-Chain' },
    { id: 'term-11', title: '11. Medicine Quality & Compliance' },
    { id: 'term-12', title: '12. Waste Disposal Protocols' },
    { id: 'term-13', title: '13. Prohibited Use' },
    { id: 'term-14', title: '14. Intellectual Property' },
    { id: 'term-15', title: '15. Service Availability' },
    { id: 'term-16', title: '16. Limitation of Liability' },
    { id: 'term-17', title: '17. Changes to Terms' },
    { id: 'term-18', title: '18. Contact & Notice' },
  ];

  return (
    <div className="space-y-12 pb-20">
      
      {/* Header */}
      <section className="bg-gradient-to-b from-primary-900 via-secondary-900 to-slate-950 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-secondary-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <FileText className="w-3.5 h-3.5" />
            <span>Institutional Governance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Terms & Conditions
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-medium">
            Platform terms of service and statutory operating conditions for participating hospitals.
          </p>

          <p className="text-[11px] font-mono text-slate-400">
            Last updated: September 2026 • Demo Prototype Version
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Statutory Regulatory Disclaimer */}
        <div className="mb-10 p-5 rounded-3xl bg-amber-50/90 border border-amber-200/90 shadow-sm flex items-start gap-4">
          <div className="w-9 h-9 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0 font-bold">
            <AlertCircle className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-extrabold text-amber-950">
              Statutory Clarification & Compliance Disclaimer
            </h3>
            <p className="text-amber-900 leading-relaxed">
              MedEx is a digital coordination and inventory exchange interface. MedEx does not itself manufacture, retail, or hold title to pharmaceutical products. Actual production operation must comply with applicable pharmaceutical regulations, including the Drugs and Cosmetics Act 1940, CDSCO rules, and Pharmacy Practice Regulations.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Table of Contents */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm lg:sticky lg:top-24 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">
              Sections Index
            </span>
            <nav className="space-y-1 max-h-[60vh] overflow-y-auto text-xs">
              {sections.map((sec) => (
                <a
                  key={sec.id}
                  href={`#${sec.id}`}
                  onClick={() => setActiveSection(sec.id)}
                  className={`block px-3 py-1.5 rounded-xl transition-all ${
                    activeSection === sec.id
                      ? 'bg-primary-50 text-primary-800 font-extrabold'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 font-medium'
                  }`}
                >
                  {sec.title}
                </a>
              ))}
            </nav>
          </div>

          {/* Policy Content */}
          <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-sm space-y-10 text-xs text-slate-600 leading-relaxed">
            
            {/* 1 */}
            <section id="term-1" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                1. Acceptance of Terms
              </h2>
              <p>
                By accessing, registering, or executing transactions on MedEx, participating healthcare institutions agree to be bound by these Terms and Conditions. If an institution does not agree to these terms, it must not utilize the platform.
              </p>
            </section>

            {/* 2 */}
            <section id="term-2" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                2. Description of MedEx
              </h2>
              <p>
                MedEx provides digital software tools enabling verified hospitals to list near-expiry or surplus pharmaceutical inventories for inter-institutional redistribution, track simulated cold-chain delivery corridors, and manage statutory bio-medical destruction records.
              </p>
            </section>

            {/* 3 */}
            <section id="term-3" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                3. Hospital Eligibility
              </h2>
              <p>
                Participation is restricted strictly to licensed hospitals, tertiary care centers, nursing homes, and recognized healthcare institutions. Accounts are not issued to retail consumers or unauthorized intermediaries.
              </p>
            </section>

            {/* 4 */}
            <section id="term-4" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                4. Account Responsibilities
              </h2>
              <p>
                Institutions are solely responsible for maintaining the confidentiality of their terminal access keys. Any action performed through an authenticated hospital account is deemed to be authorized by the facility’s Chief Pharmacist or designated medical director.
              </p>
            </section>

            {/* 5 */}
            <section id="term-5" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                5. Hospital Verification
              </h2>
              <p>
                Every hospital registration is subject to document verification by supervisory regulatory administrators. Platform privileges may be restricted or suspended if uploaded accreditation credentials expire or fail statutory audit.
              </p>
            </section>

            {/* 6 */}
            <section id="term-6" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                6. Medicine Listings
              </h2>
              <p>
                The listing hospital warrants that all listed items:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Are genuine, unadulterated pharmaceutical products sourced from certified manufacturers.</li>
                <li>Have been stored in continuous conformity with manufacturer temperature guidelines.</li>
                <li>Possess intact tamper-evident packaging and legible batch numbering.</li>
              </ul>
            </section>

            {/* 7 */}
            <section id="term-7" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                7. Medicine Requests
              </h2>
              <p>
                A medicine transfer request represents an institutional requisition for specified units. The listing hospital retains discretion to confirm or decline the request based on physical warehouse availability.
              </p>
            </section>

            {/* 8 */}
            <section id="term-8" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                8. 48-Hour Request Expiry
              </h2>
              <p>
                <strong>Critical Operational Rule:</strong> Any medicine transfer request that is neither accepted nor declined by the listing hospital within forty-eight (48) hours of creation automatically expires. Reserved stock units are immediately returned to the active marketplace catalog.
              </p>
            </section>

            {/* 9 */}
            <section id="term-9" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                9. Payments & Escrow
              </h2>
              <p>
                All financial transfers between institutions are settled through structured payment gateways with escrow holding. Funds are released to the seller hospital only after the receiving dock signs off on intake inspection.
              </p>
            </section>

            {/* 10 */}
            <section id="term-10" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                10. Logistics & Cold-Chain
              </h2>
              <p>
                Physical delivery of pharmaceuticals must utilize certified insulated containers. In the prototype application, corridor tracking is demonstrated with simulated telemetry checkpoints.
              </p>
            </section>

            {/* 11 */}
            <section id="term-11" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                11. Medicine Quality & Compliance
              </h2>
              <p>
                The selling hospital bears full statutory responsibility for product authenticity, accurate storage declaration, and batch tracking prior to handover. The receiving hospital is obligated to conduct dock inspection upon delivery.
              </p>
            </section>

            {/* 12 */}
            <section id="term-12" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                12. Waste Disposal Protocols
              </h2>
              <p>
                Pharmaceuticals that reach terminal expiry must be transferred to authorized bio-medical waste treatment operators in accordance with State Pollution Control Board guidelines. MedEx provides logging manifests for destruction compliance.
              </p>
            </section>

            {/* 13 */}
            <section id="term-13" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                13. Prohibited Use
              </h2>
              <p>
                Users agree not to list banned drugs, counterfeit formulations, Schedule X substances without statutory authorization, or submit fraudulent regulatory licenses.
              </p>
            </section>

            {/* 14 */}
            <section id="term-14" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                14. Intellectual Property
              </h2>
              <p>
                The software interface, branding, routing algorithms, and workflow architectures of MedEx are proprietary property.
              </p>
            </section>

            {/* 15 */}
            <section id="term-15" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                15. Service Availability
              </h2>
              <p>
                We strive for maximum system uptime but do not guarantee uninterrupted platform availability. Scheduled maintenance and upgrades are communicated via the notification drawer.
              </p>
            </section>

            {/* 16 */}
            <section id="term-16" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                16. Limitation of Liability
              </h2>
              <p>
                In no event shall the platform operators be liable for indirect, incidental, or clinical damages resulting from medicine administration. Participating hospitals maintain independent clinical and pharmaceutical responsibility.
              </p>
            </section>

            {/* 17 */}
            <section id="term-17" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                17. Changes to Terms
              </h2>
              <p>
                These Terms may be revised periodically. Notice of material modifications will be posted to this page with an updated revision date.
              </p>
            </section>

            {/* 18 */}
            <section id="term-18" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                18. Contact & Notice
              </h2>
              <p>
                Formal institutional communications or legal inquiries may be directed through the <Link to="/hospital/feedback" className="text-primary-600 font-bold underline">Institutional Feedback System</Link>.
              </p>
            </section>

          </div>

        </div>

      </div>

    </div>
  );
};

export default TermsPage;
