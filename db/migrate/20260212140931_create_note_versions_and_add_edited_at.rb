class CreateNoteVersionsAndAddEditedAt < ActiveRecord::Migration[8.1]
  def change
    create_table :note_versions do |t|
      t.references :note, null: false, foreign_key: true
      t.text :previous_body, null: false
      t.datetime :created_at, null: false
    end

    add_column :notes, :edited_at, :datetime
  end
end
