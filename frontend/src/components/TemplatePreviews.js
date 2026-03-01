import React from 'react';

const previews = [
    {
        title: "Health Alert Status",
        subtitle: "Critical health warnings and alerts",
        badges: ["Alert", "2 sections"],
        selected: true,
        image: "https://images.unsplash.com/photo-1584515933487-780219d29b4b?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Family Health Dashboard",
        subtitle: "Manage family member health profiles",
        badges: ["Dashboard", "3 sections"],
        image: "https://images.unsplash.com/photo-1581056334352-c44dca9f5830?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Health Trends Analysis",
        subtitle: "Monitor patient health metrics over time",
        badges: ["Analytics", "4 sections"],
        image: "https://images.unsplash.com/photo-1576671081741-cb5940089e90?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Emergency Alert Detection",
        subtitle: "Real-time health anomaly detection",
        badges: ["Alert", "3 sections"],
        image: "https://images.unsplash.com/photo-1576091160550-217359f4ecf8?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Report Analysis",
        subtitle: "Detailed health score visualization",
        badges: ["Report", "3 sections"],
        image: "https://images.unsplash.com/photo-1581093458791-9f3c3250bb8b?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Advanced Features Dashboard",
        subtitle: "AI-powered medical analysis tools",
        badges: ["Dashboard", "2 sections"],
        image: "https://images.unsplash.com/photo-1504868584819-f8e905263543?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Localized Health Report",
        subtitle: "Multi-language health scores and preferences",
        badges: ["Report", "3 sections"],
        image: "https://images.unsplash.com/photo-1579152276503-68fe28dc4324?auto=format&fit=crop&w=1000&q=80"
    },
    {
        title: "Login Page",
        subtitle: "Secure authentication for medical data",
        badges: ["Authentication", "3 sections"],
        image: "https://images.unsplash.com/photo-1555949963-ff9fe0c870eb?auto=format&fit=crop&w=1000&q=80"
    }
];

export default function TemplatePreviews() {
    return (
        <div className="previews-container">
            {previews.map((item, index) => (
                <section key={index} className="preview-section">
                    <div className="preview-header">
                        {item.selected && <div className="selected-template-badge">✨ Selected Template</div>}
                        <h1>{item.title}</h1>
                        <p>{item.subtitle}</p>
                        <div className="preview-badges">
                            {item.badges.map((badge, bIndex) => (
                                <span key={bIndex} className="badge">{badge}</span>
                            ))}
                        </div>
                    </div>

                    <div className="template-preview-card">
                        <h2>Template Preview</h2>
                        <div className="preview-image-wrapper">
                            <img src={item.image} alt={item.title} className="preview-image" />
                        </div>
                    </div>
                </section>
            ))}
        </div>
    );
}
