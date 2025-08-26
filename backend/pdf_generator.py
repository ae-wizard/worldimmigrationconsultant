#!/usr/bin/env python3
"""
Immigration Report PDF Generator

Generates professional PDF reports for immigration consultations including:
- Immigration roadmap documents
- Document checklists
- Cost breakdown reports
- Timeline reports
- Government form guides
"""

import io
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter, A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.graphics.shapes import Drawing, Rect
from reportlab.graphics.charts.barcharts import VerticalBarChart
import sqlite3
import json
import csv

class ImmigrationPDFGenerator:
    def __init__(self):
        self.styles = getSampleStyleSheet()
        self.setup_custom_styles()
        
    def setup_custom_styles(self):
        """Setup custom styles for professional PDF documents"""
        
        # Title style
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Title'],
            fontSize=24,
            spaceAfter=30,
            textColor=colors.HexColor('#667eea'),
            alignment=1  # Center
        ))
        
        # Subtitle style
        self.styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=self.styles['Heading1'],
            fontSize=16,
            spaceAfter=20,
            textColor=colors.HexColor('#764ba2'),
            borderWidth=1,
            borderColor=colors.HexColor('#667eea'),
            borderPadding=10,
            backColor=colors.HexColor('#f8fafc')
        ))
        
        # Section header style
        self.styles.add(ParagraphStyle(
            name='SectionHeader',
            parent=self.styles['Heading2'],
            fontSize=14,
            spaceAfter=15,
            textColor=colors.HexColor('#374151'),
            borderWidth=0,
            borderColor=colors.HexColor('#e5e7eb'),
            backColor=colors.HexColor('#f9fafb'),
            borderPadding=8
        ))
        
        # Important note style
        self.styles.add(ParagraphStyle(
            name='ImportantNote',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#dc2626'),
            backColor=colors.HexColor('#fef2f2'),
            borderWidth=1,
            borderColor=colors.HexColor('#fecaca'),
            borderPadding=10,
            spaceAfter=15
        ))
        
        # Success style
        self.styles.add(ParagraphStyle(
            name='SuccessNote',
            parent=self.styles['Normal'],
            fontSize=11,
            textColor=colors.HexColor('#059669'),
            backColor=colors.HexColor('#f0fdf4'),
            borderWidth=1,
            borderColor=colors.HexColor('#bbf7d0'),
            borderPadding=10,
            spaceAfter=15
        ))

    def create_header_footer(self, canvas, doc):
        """Add header and footer to each page"""
        
        # Header
        canvas.saveState()
        canvas.setFont('Helvetica-Bold', 16)
        canvas.setFillColor(colors.HexColor('#667eea'))
        canvas.drawString(50, letter[1] - 50, "🌍 World Immigration Consultant")
        
        canvas.setFont('Helvetica', 10)
        canvas.setFillColor(colors.HexColor('#6b7280'))
        canvas.drawString(50, letter[1] - 65, "Professional Immigration Guidance for 131+ Countries")
        
        # Header line
        canvas.setStrokeColor(colors.HexColor('#e5e7eb'))
        canvas.line(50, letter[1] - 75, letter[0] - 50, letter[1] - 75)
        
        # Footer
        canvas.setFont('Helvetica', 9)
        canvas.setFillColor(colors.HexColor('#9ca3af'))
        footer_text = f"Generated on {datetime.now().strftime('%B %d, %Y')} • worldimmigrationconsultant.com"
        canvas.drawString(50, 50, footer_text)
        
        # Page number
        page_num = f"Page {doc.page}"
        canvas.drawRightString(letter[0] - 50, 50, page_num)
        
        canvas.restoreState()

    def generate_immigration_roadmap(self, user_data: Dict, consultation_data: Dict) -> bytes:
        """Generate comprehensive immigration roadmap PDF"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=letter,
            rightMargin=50,
            leftMargin=50,
            topMargin=100,
            bottomMargin=100
        )
        
        story = []
        
        # Title page
        story.append(Paragraph("Immigration Roadmap", self.styles['CustomTitle']))
        story.append(Spacer(1, 20))
        
        # User info section
        story.append(Paragraph(f"Prepared for: {user_data.get('first_name', '')} {user_data.get('last_name', '')}", self.styles['CustomSubtitle']))
        story.append(Paragraph(f"Destination: {consultation_data.get('destination_country', 'Not specified')}", self.styles['Normal']))
        story.append(Paragraph(f"Origin: {consultation_data.get('origin_country', 'Not specified')}", self.styles['Normal']))
        story.append(Paragraph(f"Immigration Goal: {consultation_data.get('goal', 'Not specified')}", self.styles['Normal']))
        story.append(Spacer(1, 30))
        
        # Executive Summary
        story.append(Paragraph("Executive Summary", self.styles['SectionHeader']))
        summary_text = self._generate_executive_summary(consultation_data)
        story.append(Paragraph(summary_text, self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Immigration pathway overview
        story.append(Paragraph("Recommended Immigration Pathway", self.styles['SectionHeader']))
        pathway_data = self._get_pathway_recommendations(consultation_data)
        
        # Create pathway table
        pathway_table_data = [
            ['Step', 'Description', 'Timeline', 'Priority'],
        ]
        
        for i, step in enumerate(pathway_data, 1):
            pathway_table_data.append([
                str(i),
                step['description'],
                step['timeline'],
                step['priority']
            ])
        
        pathway_table = Table(pathway_table_data, colWidths=[0.5*inch, 3*inch, 1*inch, 1*inch])
        pathway_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        story.append(pathway_table)
        story.append(Spacer(1, 20))
        
        # Document requirements
        story.append(Paragraph("Required Documents", self.styles['SectionHeader']))
        documents = self._get_required_documents(consultation_data)
        
        for category, doc_list in documents.items():
            story.append(Paragraph(f"<b>{category}</b>", self.styles['Normal']))
            for doc in doc_list:
                story.append(Paragraph(f"• {doc}", self.styles['Normal']))
            story.append(Spacer(1, 10))
        
        # Cost breakdown
        story.append(PageBreak())
        story.append(Paragraph("Cost Analysis", self.styles['SectionHeader']))
        
        cost_data = self._get_cost_breakdown(consultation_data)
        cost_table_data = [['Fee Type', 'Amount (USD)', 'Due Date', 'Notes']]
        
        total_cost = 0
        for cost in cost_data:
            cost_table_data.append([
                cost['type'],
                f"${cost['amount']:,}",
                cost['due_date'],
                cost['notes']
            ])
            total_cost += cost['amount']
        
        # Add total row
        cost_table_data.append(['TOTAL', f"${total_cost:,}", '', 'Estimated total cost'])
        
        cost_table = Table(cost_table_data, colWidths=[2*inch, 1*inch, 1.5*inch, 2*inch])
        cost_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 12),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -2), colors.beige),
            ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#fef3c7')),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
        ]))
        
        story.append(cost_table)
        story.append(Spacer(1, 20))
        
        # Timeline
        story.append(Paragraph("Processing Timeline", self.styles['SectionHeader']))
        timeline_data = self._get_timeline_estimates(consultation_data)
        
        timeline_text = f"""
        <b>Estimated Total Processing Time:</b> {timeline_data['total_time']}<br/>
        <b>Key Milestones:</b><br/>
        """
        
        for milestone in timeline_data['milestones']:
            timeline_text += f"• {milestone['name']}: {milestone['timeframe']}<br/>"
        
        story.append(Paragraph(timeline_text, self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Important notes
        story.append(Paragraph("⚠️ Important Considerations", self.styles['ImportantNote']))
        important_notes = self._get_important_notes(consultation_data)
        for note in important_notes:
            story.append(Paragraph(f"• {note}", self.styles['Normal']))
        
        story.append(Spacer(1, 20))
        
        # Next steps
        story.append(Paragraph("✅ Recommended Next Steps", self.styles['SuccessNote']))
        next_steps = self._get_next_steps(consultation_data)
        for i, step in enumerate(next_steps, 1):
            story.append(Paragraph(f"{i}. {step}", self.styles['Normal']))
        
        # Build PDF
        doc.build(story, onFirstPage=self.create_header_footer, onLaterPages=self.create_header_footer)
        
        buffer.seek(0)
        return buffer.read()

    def generate_document_checklist(self, user_data: Dict, consultation_data: Dict) -> bytes:
        """Generate detailed document checklist PDF"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=100, bottomMargin=100)
        
        story = []
        
        # Title
        story.append(Paragraph("Document Checklist", self.styles['CustomTitle']))
        story.append(Spacer(1, 20))
        
        # User info
        story.append(Paragraph(f"For: {user_data.get('first_name', '')} {user_data.get('last_name', '')}", self.styles['CustomSubtitle']))
        story.append(Paragraph(f"Immigration Type: {consultation_data.get('goal', '')} to {consultation_data.get('destination_country', '')}", self.styles['Normal']))
        story.append(Spacer(1, 30))
        
        # Document sections
        documents = self._get_detailed_document_requirements(consultation_data)
        
        for section, docs in documents.items():
            story.append(Paragraph(section, self.styles['SectionHeader']))
            
            # Create checklist table
            checklist_data = [['✓', 'Document', 'Requirements', 'Notes']]
            
            for doc in docs:
                checklist_data.append([
                    '☐',  # Checkbox
                    doc['name'],
                    doc['requirements'],
                    doc['notes']
                ])
            
            checklist_table = Table(checklist_data, colWidths=[0.3*inch, 2*inch, 2.5*inch, 1.7*inch])
            checklist_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (0, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTSIZE', (0, 0), (-1, 0), 11),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                ('FONTSIZE', (0, 1), (0, -1), 14),  # Checkbox column
            ]))
            
            story.append(checklist_table)
            story.append(Spacer(1, 20))
        
        # Additional tips
        story.append(Paragraph("📋 Document Preparation Tips", self.styles['SectionHeader']))
        tips = [
            "Ensure all documents are in English or officially translated",
            "Keep original copies safe - submit certified copies only",
            "Check expiration dates - documents should be valid for at least 6 months",
            "Notarize documents where required by the destination country",
            "Organize documents in the order listed in this checklist"
        ]
        
        for tip in tips:
            story.append(Paragraph(f"• {tip}", self.styles['Normal']))
        
        doc.build(story, onFirstPage=self.create_header_footer, onLaterPages=self.create_header_footer)
        
        buffer.seek(0)
        return buffer.read()

    def generate_cost_breakdown_report(self, user_data: Dict, consultation_data: Dict) -> bytes:
        """Generate detailed cost breakdown PDF"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=100, bottomMargin=100)
        
        story = []
        
        # Title
        story.append(Paragraph("Immigration Cost Analysis", self.styles['CustomTitle']))
        story.append(Spacer(1, 20))
        
        # User info
        story.append(Paragraph(f"Prepared for: {user_data.get('first_name', '')} {user_data.get('last_name', '')}", self.styles['CustomSubtitle']))
        story.append(Spacer(1, 30))
        
        # Cost categories
        cost_data = self._get_detailed_cost_breakdown(consultation_data)
        
        grand_total = 0
        
        for category, costs in cost_data.items():
            story.append(Paragraph(category, self.styles['SectionHeader']))
            
            category_data = [['Item', 'Cost (USD)', 'Payment Timeline', 'Description']]
            category_total = 0
            
            for cost in costs:
                category_data.append([
                    cost['item'],
                    f"${cost['amount']:,}",
                    cost['timeline'],
                    cost['description']
                ])
                category_total += cost['amount']
            
            # Add category total
            category_data.append(['SUBTOTAL', f"${category_total:,}", '', ''])
            
            cost_table = Table(category_data, colWidths=[2*inch, 1*inch, 1.5*inch, 2*inch])
            cost_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
                ('BACKGROUND', (0, -1), (-1, -1), colors.HexColor('#f3f4f6')),
                ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ]))
            
            story.append(cost_table)
            story.append(Spacer(1, 20))
            grand_total += category_total
        
        # Grand total
        story.append(Paragraph("💰 Total Investment Summary", self.styles['SectionHeader']))
        story.append(Paragraph(f"<b>Total Estimated Cost: ${grand_total:,} USD</b>", self.styles['CustomSubtitle']))
        
        # Payment recommendations
        story.append(Spacer(1, 20))
        story.append(Paragraph("💡 Financial Planning Recommendations", self.styles['SectionHeader']))
        
        recommendations = [
            f"Budget an additional 10-15% (${int(grand_total * 0.125):,}) for unexpected costs",
            "Start saving early - immigration processes can take 12-36 months",
            "Consider currency exchange rate fluctuations when budgeting",
            "Some fees may be refundable if application is withdrawn early",
            "Premium processing options may be available for urgent cases"
        ]
        
        for rec in recommendations:
            story.append(Paragraph(f"• {rec}", self.styles['Normal']))
        
        doc.build(story, onFirstPage=self.create_header_footer, onLaterPages=self.create_header_footer)
        
        buffer.seek(0)
        return buffer.read()

    def _generate_executive_summary(self, consultation_data: Dict) -> str:
        """Generate executive summary based on consultation data"""
        
        destination = consultation_data.get('destination_country', 'your chosen destination')
        origin = consultation_data.get('origin_country', 'your current location')
        goal = consultation_data.get('goal', 'immigration')
        
        return f"""
        This comprehensive immigration roadmap outlines the recommended pathway for your {goal} 
        immigration from {origin} to {destination}. Based on current immigration laws and 
        regulations, this report provides step-by-step guidance, required documentation, 
        cost estimates, and timeline projections to help you successfully navigate the 
        immigration process.
        
        Our analysis includes the most current government requirements and processing times 
        as of {datetime.now().strftime('%B %Y')}. Please note that immigration laws can 
        change, and we recommend verifying all information with official government sources 
        before proceeding.
        """

    def _get_pathway_recommendations(self, consultation_data: Dict) -> List[Dict]:
        """Get immigration pathway recommendations"""
        
        goal = consultation_data.get('goal', 'general')
        destination = consultation_data.get('destination_country', 'destination')
        
        if goal == 'work':
            return [
                {'description': 'Secure job offer from authorized employer', 'timeline': '2-6 months', 'priority': 'High'},
                {'description': 'Obtain Labor Market Impact Assessment (if required)', 'timeline': '2-4 weeks', 'priority': 'High'},
                {'description': 'Submit work permit application', 'timeline': '4-12 weeks', 'priority': 'High'},
                {'description': 'Complete medical examinations', 'timeline': '1-2 weeks', 'priority': 'Medium'},
                {'description': 'Attend visa interview (if required)', 'timeline': '2-4 weeks', 'priority': 'Medium'},
            ]
        elif goal == 'study':
            return [
                {'description': 'Apply and get accepted to recognized educational institution', 'timeline': '3-6 months', 'priority': 'High'},
                {'description': 'Obtain letter of acceptance', 'timeline': '2-4 weeks', 'priority': 'High'},
                {'description': 'Prove financial support capability', 'timeline': '2-3 weeks', 'priority': 'High'},
                {'description': 'Submit student visa application', 'timeline': '4-8 weeks', 'priority': 'High'},
                {'description': 'Complete medical and background checks', 'timeline': '2-4 weeks', 'priority': 'Medium'},
            ]
        else:
            return [
                {'description': 'Determine eligibility for immigration programs', 'timeline': '1-2 weeks', 'priority': 'High'},
                {'description': 'Gather required documentation', 'timeline': '4-8 weeks', 'priority': 'High'},
                {'description': 'Submit initial application', 'timeline': '2-4 weeks', 'priority': 'High'},
                {'description': 'Complete background and medical checks', 'timeline': '4-8 weeks', 'priority': 'Medium'},
                {'description': 'Attend interview or provide additional information', 'timeline': '2-6 weeks', 'priority': 'Medium'},
            ]

    def _get_required_documents(self, consultation_data: Dict) -> Dict[str, List[str]]:
        """Get required documents by category"""
        
        return {
            "Identity Documents": [
                "Valid passport (minimum 6 months validity)",
                "Birth certificate",
                "National identity card",
                "Marriage certificate (if applicable)",
                "Divorce decree (if applicable)"
            ],
            "Educational Documents": [
                "Highest degree/diploma certificates",
                "Official transcripts",
                "Educational credential assessment",
                "Professional licensing certificates"
            ],
            "Employment Documents": [
                "Employment contracts",
                "Letters of reference from employers",
                "Pay stubs and tax returns",
                "Professional portfolio or work samples"
            ],
            "Financial Documents": [
                "Bank statements (last 6 months)",
                "Investment portfolio statements",
                "Property ownership documents",
                "Sponsorship letters (if applicable)"
            ],
            "Health and Character": [
                "Medical examination results",
                "Vaccination records",
                "Police clearance certificates",
                "Character references"
            ]
        }

    def _get_detailed_document_requirements(self, consultation_data: Dict) -> Dict[str, List[Dict]]:
        """Get detailed document requirements with specific notes"""
        
        return {
            "📋 Identity & Personal Documents": [
                {
                    'name': 'Valid Passport',
                    'requirements': 'Minimum 6 months validity, blank pages available',
                    'notes': 'Renew if expiring soon'
                },
                {
                    'name': 'Birth Certificate',
                    'requirements': 'Official government-issued, with apostille if required',
                    'notes': 'Must show both parents names'
                },
                {
                    'name': 'Marriage Certificate',
                    'requirements': 'Official certificate with apostille',
                    'notes': 'Required if married/divorced'
                }
            ],
            "🎓 Educational Credentials": [
                {
                    'name': 'Degree Certificates',
                    'requirements': 'All post-secondary certificates',
                    'notes': 'Arrange by highest to lowest'
                },
                {
                    'name': 'Official Transcripts',
                    'requirements': 'Sealed, directly from institution',
                    'notes': 'May require credential evaluation'
                }
            ],
            "💼 Employment Records": [
                {
                    'name': 'Employment Letters',
                    'requirements': 'On company letterhead, signed by HR',
                    'notes': 'Include duties, salary, dates'
                },
                {
                    'name': 'Tax Returns',
                    'requirements': 'Last 3 years, government certified',
                    'notes': 'Show income consistency'
                }
            ]
        }

    def _get_cost_breakdown(self, consultation_data: Dict) -> List[Dict]:
        """Get basic cost breakdown"""
        
        return [
            {'type': 'Government Application Fee', 'amount': 550, 'due_date': 'At application', 'notes': 'Non-refundable'},
            {'type': 'Medical Examination', 'amount': 200, 'due_date': 'Before application', 'notes': 'Valid for 1 year'},
            {'type': 'Police Clearance', 'amount': 50, 'due_date': 'Before application', 'notes': 'From each country lived'},
            {'type': 'Document Translation', 'amount': 300, 'due_date': 'Before application', 'notes': 'Certified translations'},
            {'type': 'Legal Consultation', 'amount': 500, 'due_date': 'Optional', 'notes': 'Recommended for complex cases'},
        ]

    def _get_detailed_cost_breakdown(self, consultation_data: Dict) -> Dict[str, List[Dict]]:
        """Get detailed cost breakdown by category"""
        
        return {
            "🏛️ Government Fees": [
                {'item': 'Visa Application Fee', 'amount': 550, 'timeline': 'At submission', 'description': 'Primary applicant fee'},
                {'item': 'Biometrics Fee', 'amount': 85, 'timeline': 'At submission', 'description': 'Fingerprints and photo'},
                {'item': 'Right of Permanent Residence Fee', 'amount': 500, 'timeline': 'Before landing', 'description': 'If approved'},
            ],
            "🏥 Medical & Background Checks": [
                {'item': 'Medical Examination', 'amount': 200, 'timeline': 'Before application', 'description': 'Panel physician exam'},
                {'item': 'Police Clearance Certificate', 'amount': 50, 'timeline': 'Before application', 'description': 'From each country lived'},
                {'item': 'Background Verification', 'amount': 100, 'timeline': 'During processing', 'description': 'Security screening'},
            ],
            "📄 Documentation & Translation": [
                {'item': 'Document Translation', 'amount': 300, 'timeline': 'Before application', 'description': 'Certified translations'},
                {'item': 'Credential Assessment', 'amount': 200, 'timeline': 'Before application', 'description': 'Educational evaluation'},
                {'item': 'Notarization & Apostille', 'amount': 150, 'timeline': 'Before application', 'description': 'Document authentication'},
            ],
            "⚖️ Professional Services (Optional)": [
                {'item': 'Immigration Lawyer', 'amount': 2000, 'timeline': 'Throughout process', 'description': 'Legal representation'},
                {'item': 'Document Preparation Service', 'amount': 500, 'timeline': 'Before application', 'description': 'Application assistance'},
                {'item': 'Interview Preparation', 'amount': 300, 'timeline': 'If interview required', 'description': 'Coaching session'},
            ]
        }

    def _get_timeline_estimates(self, consultation_data: Dict) -> Dict:
        """Get timeline estimates"""
        
        return {
            'total_time': '12-18 months',
            'milestones': [
                {'name': 'Document preparation', 'timeframe': '2-3 months'},
                {'name': 'Application submission', 'timeframe': '1 week'},
                {'name': 'Initial review', 'timeframe': '4-8 weeks'},
                {'name': 'Additional documentation request', 'timeframe': '2-4 weeks'},
                {'name': 'Final decision', 'timeframe': '6-12 months'},
                {'name': 'Landing/Arrival preparations', 'timeframe': '1-2 months'},
            ]
        }

    def _get_important_notes(self, consultation_data: Dict) -> List[str]:
        """Get important notes and warnings"""
        
        return [
            "Immigration laws and processing times change frequently - verify current requirements",
            "Incomplete applications will be returned and cause delays",
            "Medical examinations have specific validity periods",
            "Some documents may need to be obtained from multiple countries",
            "Consider hiring professional help for complex cases",
            "Keep copies of all submitted documents for your records",
            "Processing times are estimates and can vary significantly"
        ]

    def _get_next_steps(self, consultation_data: Dict) -> List[str]:
        """Get recommended next steps"""
        
        return [
            "Review this roadmap thoroughly and bookmark government websites",
            "Start gathering required documents immediately",
            "Open a dedicated immigration file to organize all documents",
            "Research and book medical examination appointments",
            "Consider taking language proficiency tests if required",
            "Begin saving for all associated costs",
            "Schedule follow-up consultation to review progress",
            "Subscribe to immigration updates from official government sources"
        ]

    def generate_quick_summary(self, user_data: Dict, consultation_data: Dict) -> bytes:
        """Generate a quick 1-page summary PDF"""
        
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=50, leftMargin=50, topMargin=100, bottomMargin=100)
        
        story = []
        
        # Title
        story.append(Paragraph("Immigration Summary", self.styles['CustomTitle']))
        story.append(Spacer(1, 20))
        
        # Quick overview
        story.append(Paragraph(f"For: {user_data.get('first_name', '')} {user_data.get('last_name', '')}", self.styles['CustomSubtitle']))
        story.append(Paragraph(f"Goal: {consultation_data.get('goal', '')} immigration to {consultation_data.get('destination_country', '')}", self.styles['Normal']))
        story.append(Spacer(1, 20))
        
        # Key points
        summary_data = [
            ['Category', 'Details'],
            ['Recommended Pathway', 'Express Entry / Skilled Worker Program'],
            ['Est. Processing Time', '12-18 months'],
            ['Est. Total Cost', '$2,000 - $5,000 USD'],
            ['Next Step', 'Begin document collection'],
            ['Priority Documents', 'Passport, Education certificates, Employment letters'],
        ]
        
        summary_table = Table(summary_data, colWidths=[2*inch, 4*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#667eea')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ]))
        
        story.append(summary_table)
        story.append(Spacer(1, 30))
        
        # Important reminders
        story.append(Paragraph("⚠️ Important Reminders", self.styles['ImportantNote']))
        story.append(Paragraph("• Start document collection immediately<br/>• All documents must be recent and official<br/>• Consider professional consultation for complex cases", self.styles['Normal']))
        
        doc.build(story, onFirstPage=self.create_header_footer, onLaterPages=self.create_header_footer)
        
        buffer.seek(0)
        return buffer.read() 