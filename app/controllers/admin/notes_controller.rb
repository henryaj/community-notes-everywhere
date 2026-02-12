module Admin
  class NotesController < BaseController
    layout "pages"

    PER_PAGE = 50

    def index
      @page_num = [ params[:page].to_i, 1 ].max
      @notes = Note.includes(:author, :page)
                   .order(created_at: :desc)
                   .offset((@page_num - 1) * PER_PAGE)
                   .limit(PER_PAGE)
      @total_count = Note.count
      @total_pages = (@total_count.to_f / PER_PAGE).ceil
    end

    def destroy
      note = Note.find(params[:id])
      note.destroy!
      head :no_content
    end
  end
end
