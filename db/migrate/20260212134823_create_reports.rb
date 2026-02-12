class CreateReports < ActiveRecord::Migration[8.1]
  def change
    create_table :reports do |t|
      t.bigint :user_id, null: false
      t.bigint :note_id, null: false
      t.integer :reason, null: false

      t.timestamps
    end

    add_index :reports, [ :user_id, :note_id ], unique: true
    add_foreign_key :reports, :users
    add_foreign_key :reports, :notes

    add_column :notes, :reports_count, :integer, default: 0, null: false
  end
end
