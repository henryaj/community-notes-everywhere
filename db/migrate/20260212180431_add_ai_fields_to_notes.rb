class AddAiFieldsToNotes < ActiveRecord::Migration[8.1]
  def change
    add_column :notes, :ai_generated, :boolean, default: false, null: false
    add_column :notes, :ai_model, :string
  end
end
