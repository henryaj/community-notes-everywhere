module Admin
  class NotesController < BaseController
    def destroy
      note = Note.find(params[:id])
      note.destroy!
      head :no_content
    end
  end
end
