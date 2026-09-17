import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, Info, FileText, ChevronRight, Lock, Eye, Sparkles } from 'lucide-react';

export const PrivacyPolicyPage = () => {
  useEffect(() => {
    document.title = 'MedEx | Privacy Policy';
  }, []);

  const [activeSection, setActiveSection] = useState('sec-1');

  const sections = [
    { id: 'sec-1', title: '1. Introduction' },
    { id: 'sec-2', title: '2. Information We Collect' },
    { id: 'sec-3', title: '3. How We Use Information' },
    { id: 'sec-4', title: '4. Hospital Information' },
    { id: 'sec-5', title: '5. Uploaded Documents' },
    { id: 'sec-6', title: '6. Account Information' },
    { id: 'sec-7', title: '7. Medicine & Transaction Information' },
    { id: 'sec-8', title: '8. Cookies and Local Storage' },
    { id: 'sec-9', title: '9. Data Sharing' },
    { id: 'sec-10', title: '10. Data Security' },
    { id: 'sec-11', title: '11. Data Retention' },
    { id: 'sec-12', title: '12. User Rights' },
    { id: 'sec-13', title: "13. Children's Privacy" },
    { id: 'sec-14', title: '14. Changes to This Policy' },
    { id: 'sec-15', title: '15. Contact' },
  ];

  return (
    <div className="space-y-12 pb-20">
      
      {/* Header */}
      <section className="bg-gradient-to-b from-primary-900 via-secondary-900 to-slate-950 text-white py-14 px-4 sm:px-6 lg:px-8 border-b border-secondary-800">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/15 text-cyan-300 text-xs font-bold uppercase tracking-wider">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Transparency & Data Standards</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            Privacy Policy
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 max-w-xl mx-auto font-medium">
            Understand how institutional information, pharmacy registrations, and medicine transfer records are handled.
          </p>

          <p className="text-[11px] font-mono text-slate-400">
            Last updated: September 2026 • Demo Prototype Version
          </p>
        </div>
      </section>

      {/* Main Container */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Prototype Transparency Notice */}
        <div className="mb-10 p-5 rounded-3xl bg-blue-50/80 border border-blue-200/90 shadow-sm flex items-start gap-4">
          <div className="w-9 h-9 rounded-2xl bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0 font-bold">
            <Info className="w-4 h-4" />
          </div>
          <div className="space-y-1 text-xs">
            <h3 className="text-sm font-extrabold text-blue-950">
              Notice Concerning Demo Prototype Architecture
            </h3>
            <p className="text-blue-900 leading-relaxed">
              During the current demo implementation, MedEx operates primarily using frontend state and local storage simulation. Actual production data handling, remote server encryption, and statutory audit logging will depend on the final backend and cloud infrastructure deployed by the implementing entity.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Table of Contents (Sticky on Desktop) */}
          <div className="lg:col-span-4 bg-white rounded-3xl border border-slate-200/90 p-5 shadow-sm lg:sticky lg:top-24 space-y-3">
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 block border-b border-slate-100 pb-2">
              On This Page
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
            <section id="sec-1" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                1. Introduction
              </h2>
              <p>
                This Privacy Policy outlines how the MedEx platform ("we", "us", or "our") processes institutional data. This policy is written to provide plain-language clarity regarding how information submitted through the interface is managed.
              </p>
              <p>
                MedEx is designed exclusively for business-to-business (B2B) interactions between verified hospitals, medical clinics, and state regulatory authorities. It is not intended for individual consumers or retail patient drug sales.
              </p>
            </section>

            {/* 2 */}
            <section id="sec-2" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                2. Information We Collect
              </h2>
              <p>
                In the course of using the platform, the following categories of institutional information may be gathered:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li><strong>Hospital Identity:</strong> Registered facility legal name, State Health Authority registration code, and physical campus location.</li>
                <li><strong>Professional Contacts:</strong> Name, work email address, and official telephone number of the Chief Pharmacist or authorized medical director.</li>
                <li><strong>Statutory Proofs:</strong> Uploaded compliance documentation such as Pharmacy Drug Licenses (Form 20B/21B) and GSTIN certificates.</li>
                <li><strong>Medicine Inventory Records:</strong> Pharmaceutical brand name, generic formula, batch number, manufacturer, expiry date, storage conditions, and reserved quantity.</li>
              </ul>
            </section>

            {/* 3 */}
            <section id="sec-3" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                3. How We Use Information
              </h2>
              <p>Information provided is used strictly to fulfill the following operational goals:</p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Facilitate direct medicine transfer requisitions between verified healthcare facilities.</li>
                <li>Verify institutional accreditation through regulatory supervisory reviews.</li>
                <li>Generate automated notifications for expiring pharmaceutical batches.</li>
                <li>Provide simulated corridor routing and cold-chain telemetry tracking.</li>
                <li>Automatically quarantine expired batches to maintain marketplace integrity.</li>
              </ul>
            </section>

            {/* 4 */}
            <section id="sec-4" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                4. Hospital Information
              </h2>
              <p>
                Hospital identity data (such as institution name, city, and general location) is visible to other verified participating hospitals to enable inter-facility transfer requests. Private contact telephone numbers and designated intake dock gates are shared only when an active transfer transaction is authorized.
              </p>
            </section>

            {/* 5 */}
            <section id="sec-5" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                5. Uploaded Documents
              </h2>
              <p>
                Compliance documents uploaded during registration (such as Drug Controller licenses and establishment certificates) are accessible solely by supervisory regulatory administrators for verification auditing. In the current demo implementation, uploaded documents are stored in local client state.
              </p>
            </section>

            {/* 6 */}
            <section id="sec-6" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                6. Account Information
              </h2>
              <p>
                Account passwords and master access keys are used solely for session authentication. During the current demo, mock authentication tokens are utilized. Production deployments must employ salted hashing algorithms (such as bcrypt/Argon2) and secure secret key management.
              </p>
            </section>

            {/* 7 */}
            <section id="sec-7" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                7. Medicine & Transaction Information
              </h2>
              <p>
                All medicine listings, batch quantities, price concessions, and transaction histories generate audit records visible to the transacting parties and the supervisory administrator. No patient-identifiable data (PHI) is collected or stored within these batch records.
              </p>
            </section>

            {/* 8 */}
            <section id="sec-8" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                8. Cookies and Local Storage
              </h2>
              <p>
                The platform does not deploy third-party advertising or commercial tracking cookies. Browser <code className="bg-slate-100 px-1 py-0.5 rounded text-[11px] font-mono">localStorage</code> is used strictly to retain prototype session tokens, active hospital switching data, and interface preference states. You may manage these settings on our <Link to="/cookie-preferences" className="text-primary-600 font-bold underline">Cookie Preferences</Link> page.
              </p>
            </section>

            {/* 9 */}
            <section id="sec-9" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                9. Data Sharing
              </h2>
              <p>
                We do not sell, rent, or monetize institutional healthcare data. Information is shared strictly:
              </p>
              <ul className="list-disc pl-5 space-y-1.5">
                <li>Between transacting hospitals to execute legitimate medicine transfers.</li>
                <li>With designated logistics providers for physical cold-box transit dispatch.</li>
                <li>With supervisory regulatory administrators when required by statutory healthcare oversight rules.</li>
              </ul>
            </section>

            {/* 10 */}
            <section id="sec-10" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                10. Data Security
              </h2>
              <p>
                During this frontend prototype stage, simulated secure data structures are demonstrated. In full production deployment, the platform requires TLS 1.3 in-transit encryption, role-based access control (RBAC), and multi-tenant database isolation.
              </p>
            </section>

            {/* 11 */}
            <section id="sec-11" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                11. Data Retention
              </h2>
              <p>
                Inventory transfer logs and statutory destruction certificates are retained in compliance with standard pharmaceutical audit guidelines. In the demo application, resetting local browser storage resets all data to initial demonstration state.
              </p>
            </section>

            {/* 12 */}
            <section id="sec-12" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                12. User Rights
              </h2>
              <p>
                Participating hospitals retain the right to review, modify, or delist their surplus inventory items at any time prior to requisition acceptance. Profile information can be updated directly from the hospital command bar.
              </p>
            </section>

            {/* 13 */}
            <section id="sec-13" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                13. Children's Privacy
              </h2>
              <p>
                MedEx is strictly an institutional B2B enterprise platform and does not offer services to or collect data from individuals under the age of 18.
              </p>
            </section>

            {/* 14 */}
            <section id="sec-14" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                14. Changes to This Policy
              </h2>
              <p>
                Any updates to this privacy document will be published directly to this page with an updated revision date. Participating institutions are encouraged to review this statement periodically.
              </p>
            </section>

            {/* 15 */}
            <section id="sec-15" className="space-y-3">
              <h2 className="text-base font-extrabold text-slate-900 border-b border-slate-100 pb-2">
                15. Contact
              </h2>
              <p>
                For questions regarding data practices or to submit feedback regarding this demonstration policy, institutional representatives may reach out through the <Link to="/hospital/feedback" className="text-primary-600 font-bold underline">Platform Feedback Portal</Link>.
              </p>
            </section>

          </div>

        </div>

      </div>

    </div>
  );
};

export default PrivacyPolicyPage;
