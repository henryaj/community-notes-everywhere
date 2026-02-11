module Api
  class NotesController < ApplicationController
    before_action :authenticate!, only: [:create]

    # GET /api/notes?url=URL
    def index
      url = params[:url]
      return render json: { error: "url parameter required" }, status: :bad_request if url.blank?

      page = Page.find_by(url: Page.normalize_url_string(url))
      notes = page ? page.notes.includes(:author, :ratings).order(created_at: :desc) : []

      render json: notes.map { |note| serialize_note(note) }
    end

    # POST /api/notes
    def create
      page = Page.find_or_create_for_url(note_params[:url])
      note = current_user.notes.build(
        page: page,
        body: note_params[:body],
        selected_text: note_params[:selected_text],
        text_prefix: note_params[:text_prefix],
        text_suffix: note_params[:text_suffix],
        css_selector: note_params[:css_selector],
        sources_linked: note_params[:sources_linked]
      )

      if note.save
        render json: serialize_note(note), status: :created
      else
        render json: { errors: note.errors.full_messages }, status: :unprocessable_entity
      end
    end

    private

    def note_params
      params.require(:note).permit(:url, :body, :selected_text, :text_prefix, :text_suffix, :css_selector, :sources_linked)
    end

    def serialize_note(note)
      {
        id: note.id,
        body: note.body,
        selected_text: note.selected_text,
        text_prefix: note.text_prefix,
        text_suffix: note.text_suffix,
        css_selector: note.css_selector,
        status: note.status,
        helpful_count: note.helpful_count,
        somewhat_count: note.somewhat_count,
        not_helpful_count: note.not_helpful_count,
        created_at: note.created_at.iso8601,
        author: {
          id: note.author.id,
          handle: note.author.twitter_handle,
          display_name: note.author.display_name,
          avatar_url: note.author.avatar_url,
          reputation_score: note.author.reputation_score
        },
        current_user_rating: nil
      }
    end
  end
end
