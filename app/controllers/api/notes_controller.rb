module Api
  class NotesController < ApplicationController
    before_action :authenticate!, only: [:create, :update, :destroy]
    before_action :require_writing_reputation!, only: [:create]
    before_action :set_note, only: [:update, :destroy, :versions]
    before_action :authorize_author!, only: [:update, :destroy]

    # GET /api/notes?url=URL
    def index
      url = params[:url]
      return render json: { error: "url parameter required" }, status: :bad_request if url.blank?

      page = Page.find_by(url: Page.normalize_url_string(url))
      notes = page ? page.notes.where("reports_count < 3").includes(:author, :ratings, :reports).order(created_at: :desc) : []

      render json: {
        notes: notes.map { |note| serialize_note(note) },
        can_rate: current_user&.can_rate? || false,
        can_write: current_user&.can_write? || false
      }
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

    # PATCH /api/notes/:id
    def update
      if @note.created_at < 10.minutes.ago
        return render json: { error: "Edit window has closed (10 minutes)" }, status: :forbidden
      end

      @note.note_versions.create!(previous_body: @note.body)
      if @note.update(update_note_params.merge(edited_at: Time.current))
        render json: serialize_note(@note.reload)
      else
        render json: { errors: @note.errors.full_messages }, status: :unprocessable_entity
      end
    end

    # GET /api/notes/:id/versions
    def versions
      versions = @note.note_versions.order(created_at: :desc)
      render json: versions.map { |v| { id: v.id, previous_body: v.previous_body, created_at: v.created_at.iso8601 } }
    end

    # DELETE /api/notes/:id
    def destroy
      @note.destroy!
      head :no_content
    end

    private

    def set_note
      @note = Note.find(params[:id])
    end

    def authorize_author!
      unless @note.author_id == current_user.id
        render json: { error: "You can only modify your own notes" }, status: :forbidden
      end
    end

    def require_writing_reputation!
      unless current_user.can_write?
        render json: { error: "You need a reputation score of at least #{User::MIN_WRITING_REPUTATION} to write notes" }, status: :forbidden
      end
    end

    def note_params
      params.require(:note).permit(:url, :body, :selected_text, :text_prefix, :text_suffix, :css_selector, :sources_linked)
    end

    def update_note_params
      params.require(:note).permit(:body, :sources_linked)
    end

    def serialize_note(note)
      user_rating = current_user && note.ratings.detect { |r| r.user_id == current_user.id }
      user_reported = current_user && note.reports.any? { |r| r.user_id == current_user.id }

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
          karma: note.author.karma.round(0).to_i
        },
        edited_at: note.edited_at&.iso8601,
        edit_window_closes_at: (note.created_at + 10.minutes).iso8601,
        current_user_rating: user_rating&.helpfulness,
        current_user_reported: user_reported || false
      }
    end
  end
end
