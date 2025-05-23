import { json } from '@sveltejs/kit';

export async function POST({ request }) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        const pageNumber = parseInt(formData.get('page_number')) || 1;
        
        // In production environment, we don't have access to the PDF processing server
        // Return a dummy response with an error message
        return json({
            success: false,
            error: 'PDF analysis is not available in production. Please run the application locally with the PDF processing server running.',
            elements: []
        });
    } catch (error) {
        console.error('PDF analysis error:', error);
        return json({
            success: false,
            error: error.message || 'PDF analysis failed'
        }, { status: 500 });
    }
} 