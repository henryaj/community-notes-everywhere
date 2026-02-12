module Api
  class AiNotesController < ApplicationController
    before_action :authenticate!
    before_action :require_writing_reputation!
    before_action :require_ai_notes_enabled!

    # POST /api/ai_notes/draft
    def draft
      service = AiDraftService.new(
        selected_text: params[:selected_text],
        page_url: params[:page_url],
        surrounding_text: params[:surrounding_text]
      )

      result = service.generate

      if result[:error]
        render json: { error: "AI draft generation failed" }, status: :service_unavailable
      else
        render json: { body: result[:body], model: result[:model] }
      end
    end

    private

    def require_writing_reputation!
      unless current_user.can_write?
        render json: { error: "You need a reputation score of at least #{User::MIN_WRITING_REPUTATION} to write notes" }, status: :forbidden
      end
    end

    def require_ai_notes_enabled!
      unless current_user.can_request_ai_notes?
        render json: { error: "AI notes feature is not enabled for your account" }, status: :forbidden
      end
    end
  end
end
