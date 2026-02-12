class NotesRedirectController < ActionController::Base
  layout "pages"

  def show
    @note = Note.includes(:author, :page).find_by(short_id: params[:short_id])

    if @note.nil? || @note.hidden?
      render "not_found", status: :not_found
    end
  end
end
